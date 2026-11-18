import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER;
if (!connectionString || !containerName) throw new Error("CI Blob Storage emulator settings are required.");

const service = BlobServiceClient.fromConnectionString(connectionString);
const container = service.getContainerClient(containerName);
let ready = false;
for (let attempt = 0; attempt < 30 && !ready; attempt++) {
  try {
    await container.createIfNotExists();
    ready = true;
  } catch (error) {
    if (attempt === 29) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
await service.setProperties({ cors: [{
  allowedOrigins: "http://localhost:3000,http://127.0.0.1:3000",
  allowedMethods: "PUT",
  allowedHeaders: "content-type,x-ms-blob-type,x-ms-version",
  exposedHeaders: "etag",
  maxAgeInSeconds: 3600,
}] });
console.log("AZURITE_SERVICE_IMAGE_CONTAINER=READY");
