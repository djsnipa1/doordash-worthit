import Firecrawl from "@mendable/firecrawl-js";
import { z } from "zod";
// require('dotenv').config();
// import { dotenv } from "dotenv";
import "dotenv/config";
import fs from "fs";

// OR, for clarity and explicit built-in module import:
// import fs from 'node:fs';

// Now you can use the fs module
// const filePath = "example.txt";
// const content = "Hello, ESM world!";

// try {
//   fs.writeFileSync(filePath, content, "utf8");
//   console.log("File written successfully using ESM import!");
//
//   const readContent = fs.readFileSync(filePath, "utf8");
//   console.log("File content:", readContent);
// } catch (error) {
//   console.error("Error:", error);
// }

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

const app = new Firecrawl({
  apiKey: firecrawlApiKey,
});

// Define schema to extract contents into
const schema = z.object({
  indianapolis_gas_price: z.number().describe("The Indianapolis gas price"),
});

const extractResult = await app.extract({
  urls: ["https://gasprices.aaa.com/?state=IN"],
  params: {
    prompt:
      "Extract the first value in the Indianapolis table from the specified URL.",
    schema: schema,
  },
});

if (!extractResult.success) {
  throw new Error(`Failed to extract: ${extractResult.error}`);
}

console.log(extractResult.data);
