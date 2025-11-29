import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs/promises";

/**
 * This script fetches a webpage, extracts specific text content using a CSS selector,
 * and saves that content to a JSON file. It uses Puppeteer to handle dynamically
 * loaded content.
 *
 * TO USE THIS SCRIPT:
 * 1. Update the `urlToScrape` variable below with the URL of the webpage you want to scrape.
 * 2. Update the `selectorToExtract` variable with the CSS selector for the specific table
 *    containing the data you want.
 * 3. Run the script from your terminal:
 *    node src/scrape-vanilla.js
 */

// 1. Define the URL to scrape
const urlToScrape = "https://gasprices.aaa.com/?state=IN"; // <--- CHANGE THIS URL

// 2. Define the CSS selector for the Indianapolis accordion header
const selectorToExtract = "#ui-id-7"; // <--- CHANGE THIS SELECTOR

// 3. Define the output file path
const outputFilePath = "src/vanilla-extracted-data.json";

// Function to fetch and parse the webpage using Puppeteer
async function scrapePage(url, selector) {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2" }); // Wait until no more than 2 network connections for at least 500 ms.
    
    const html = await page.content();
    await fs.writeFile("src/page_content.html", html); // Write HTML to file for inspection
    console.log("Page HTML content written to src/page_content.html");

    const $ = cheerio.load(html);

    const extractedText = $(selector).attr('data-cost');

    if (!extractedText) {
      console.warn(
        `Warning: No 'data-cost' attribute found for selector "${selector}" on ${url}`,
      );
    }

    return extractedText;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    throw error; // Re-throw to be caught by the main function
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main function to run the scraper
async function main() {
  console.log(
    `Scraping URL: ${urlToScrape} using table selector: "${selectorToExtract}"`,
  );

  try {
    const extractedContent = await scrapePage(urlToScrape, selectorToExtract);

    const dataToSave = {
      url: urlToScrape,
      selectorUsed: selectorToExtract,
      extractedContent: extractedContent,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(outputFilePath, JSON.stringify(dataToSave, null, 2));

    console.log(
      `Successfully extracted content and saved it to ${outputFilePath}`,
    );
    console.log("Extracted Data:", dataToSave);
  } catch (error) {
    console.error("An error occurred during the scraping process:", error);
  }
}

// Run the main function
main();