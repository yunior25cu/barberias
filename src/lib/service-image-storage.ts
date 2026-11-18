import "server-only";
import { imageSize } from "image-size";

export const MAX_SERVICE_IMAGE_BYTES = 500 * 1024;
const MAX_SERVICE_IMAGE_SIDE = 1600;
const MAX_SERVICE_IMAGE_PIXELS = 2_304_000;
const WEBP_CACHE_CONTROL = "public, max-age=31536000, immutable";

function connectionParts(connectionString: string) {
  return Object.fromEntries(connectionString.split(";").filter(Boolean).map(part => {
    const separator = part.indexOf("=");
    return [part.slice(0, separator).toLowerCase(), part.slice(separator + 1)];
  }));
}

async function storageConfig() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER;
  if (!connectionString || !containerName) throw new Error("SERVICE_IMAGE_STORAGE_NOT_CONFIGURED");
  const values = connectionParts(connectionString);
  if ((!values.accountname && values.usedevelopmentstorage?.toLowerCase() !== "true") || !/^[-a-z0-9]{3,63}$/.test(containerName)) {
    throw new Error("SERVICE_IMAGE_STORAGE_NOT_CONFIGURED");
  }
  const { BlobServiceClient, StorageSharedKeyCredential } = await import("@azure/storage-blob");
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const credential = service.credential;
  if (!(credential instanceof StorageSharedKeyCredential)) throw new Error("SERVICE_IMAGE_STORAGE_NOT_CONFIGURED");
  return { containerName, credential, container: service.getContainerClient(containerName) };
}

export function isServiceImageStorageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_STORAGE_CONTAINER);
}

async function sasUrl(blobName: string, permission: string, expiresOn: Date, startsOn = new Date(Date.now() - 5 * 60_000)) {
  const { BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters } = await import("@azure/storage-blob");
  const { containerName, credential, container } = await storageConfig();
  const blob = container.getBlockBlobClient(blobName);
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse(permission),
    startsOn,
    expiresOn,
    protocol: process.env.NODE_ENV === "production" ? SASProtocol.Https : SASProtocol.HttpsAndHttp,
  }, credential).toString();
  return `${blob.url}?${sas}`;
}

export async function createServiceImageUploadUrl(blobName: string) {
  const expiresOn = new Date(Date.now() + 5 * 60_000);
  // The key is unique per upload, so create-only prevents a still-valid SAS
  // from overwriting the image after the server has validated it.
  return { uploadUrl: await sasUrl(blobName, "c", expiresOn), expiresAt: expiresOn.toISOString() };
}

export async function createServiceImageReadUrl(blobName: string) {
  if (!isServiceImageStorageConfigured()) return null;
  try {
    const now = new Date();
    const startsOn = new Date(now.getTime() - 5 * 60_000);
    const expiresOn = new Date(now.getTime() + 48 * 60 * 60_000);
    return await sasUrl(blobName, "r", expiresOn, startsOn);
  } catch {
    return null;
  }
}

export async function verifyAndFinalizeServiceImage(blobName: string) {
  const { container } = await storageConfig();
  const blob = container.getBlockBlobClient(blobName);
  const properties = await blob.getProperties();
  if (!properties.contentLength || properties.contentLength > MAX_SERVICE_IMAGE_BYTES || properties.contentType?.toLowerCase() !== "image/webp") {
    await blob.deleteIfExists().catch(() => undefined);
    throw new Error("INVALID_SERVICE_IMAGE");
  }
  const response = await blob.download(0, 65_536);
  if (!response.readableStreamBody) throw new Error("INVALID_SERVICE_IMAGE");
  const chunks: Buffer[] = [];
  for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
  const header = Buffer.concat(chunks);
  let dimensions;
  try {
    dimensions = imageSize(header);
  } catch {
    await blob.deleteIfExists().catch(() => undefined);
    throw new Error("INVALID_SERVICE_IMAGE");
  }
  if (dimensions.type !== "webp" || dimensions.width > MAX_SERVICE_IMAGE_SIDE || dimensions.height > MAX_SERVICE_IMAGE_SIDE || dimensions.width * dimensions.height > MAX_SERVICE_IMAGE_PIXELS) {
    await blob.deleteIfExists().catch(() => undefined);
    throw new Error("INVALID_SERVICE_IMAGE");
  }
  await blob.setHTTPHeaders({ blobContentType: "image/webp", blobCacheControl: WEBP_CACHE_CONTROL, blobContentDisposition: "inline" });
}

export async function deleteServiceImage(blobName: string) {
  const { container } = await storageConfig();
  await container.getBlockBlobClient(blobName).deleteIfExists();
}
