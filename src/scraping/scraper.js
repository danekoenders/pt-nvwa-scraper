import axios from "axios";
import cheerio from "cheerio";
import { prepareclaimForPinecone, batchStoreToPinecone } from "./pineconeUtils.js";
import dotenv from 'dotenv';

dotenv.config();

export const SCOPES_OF_APPLICATIONS = [
  "aminozuursynthese",
  "bindweefsel",
  "bloed",
  "bloeddruk",
  "bloedglucose",
  "bloedstolling",
  "bloedvaten",
  "botten (kinderclaim)",
  "botten - collageen/bot",
  "botten - collageen/kraakbeen",
  "botten - instandhouding",
  "botten - menopauze (ziekterisicobeperkende claim)",
  "botten - opname calcium en fosfor",
  "celdeling",
  "celmembranen",
  "cholesterol - instandhouden",
  "cholesterol - verlagen (ziekterisicobeperkende claim)",
  "cognitief",
  "cognitief (kinderclaim)",
  "cysteïnesynthese",
  "dna-synthese",
  "eiwitsynthese",
  "electrolytenbalans",
  "energie",
  "fysieke prestatie",
  "fysische en cognitieve functies",
  "gewicht",
  "gewicht - vervanging 1 hoofdmaaltijd",
  "gewicht - vervanging 2 hoofdmaaltijden",
  "gezichtsvermogen - foetus/zuigelingen (kinderclaim)",
  "gezichtsvermogen - instandhouding",
  "gezichtsvermogen - zuigelingen (kinderclaim)",
  "groei (kinderclaim)",
  "haar",
  "hart",
  "hersenen - foetus/zuigelingen (kinderclaim)",
  "hersenen - instandhouding",
  "homocysteïne",
  "hormonen",
  "huid",
  "ijzer",
  "immuunsysteem (kinderclaim)",
  "immuunsysteem - fysieke inspanning",
  "immuunsysteem - normale werking",
  "jetlag",
  "lever",
  "lichaamstemperatuur",
  "macronutrienten",
  "metabolisme - eiwitten/glycogeen",
  "metabolisme - hormonen/vitd/neurotransmitters",
  "metabolisme - koolhydraat",
  "metabolisme - lipiden",
  "metabolisme - vetzuren",
  "metabolisme - vitamine a",
  "metabolisme - zuurbase",
  "metabolisme - zwavelaminozuur",
  "mond en gebit - instandhouding tanden",
  "mond en gebit - mineralisatie",
  "mond en gebit - mineralisatie/tandbederf (ziekterisicobeperkende claim)",
  "mond en gebit - monddroogte",
  "mond en gebit - plaquezuren",
  "mond en gebit - plaquezuren/tandbederf (ziekterisicobeperkende claim)",
  "mond en gebit - tandplak/kinderen (ziekterisicobeperkende claim)",
  "mond en gebit - tandvlees",
  "nagels",
  "oxidatieve schade",
  "psychologische functie",
  "regeneratie vitamine e",
  "schildklier",
  "slaap",
  "slijmvliezen",
  "spermatogenese",
  "spieren - groei",
  "spieren - herstel",
  "spieren - instandhouden",
  "spieren - valrisico (ziekterisicobeperkende claim)",
  "spieren - werking",
  "spijsvertering fecale bulk",
  "spijsvertering lactose",
  "spijsvertering overig",
  "spijsvertering transit",
  "triglyceriden",
  "vermoeidheid",
  "wateropname",
  "zenuwstelsel",
  "zuurstoftransport",
  "zwangerschap",
  "zwangerschap (ziekterisicobeperkende claim)",
];

const baseUrl = "https://claimsdb.aa-ict.com/index.php?v=2&action=acc";
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

async function scrapeData() {
  const allVectorData = [];
  let totalClaims = 0;

  for (let scope of SCOPES_OF_APPLICATIONS) {
    const url = `${baseUrl}&master=${scope}&nutrient=Alles`;

    try {
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      console.log(`Scraping ${scope}...`);

      $("div.ui-load-accordion h3").each((i, element) => {
        const nutrientName = $(element).text().trim();

        $(element)
          .next("div")
          .find("li")
          .each((j, li) => {
            if (
              $(li)
                .find("strong")
                .text()
                .includes("Alternatieve voorbeeld bewoordingen")
            ) {
              $(li)
                .find("ul > li")
                .each((k, claimLi) => {
                  const claimText = $(claimLi).text().trim();
                  let claimType = "general";
                  
                  if (claimText.startsWith("Toegestaan:")) {
                    claimType = "allowed";
                  } else if (claimText.startsWith("Niet toegestaan:")) {
                    claimType = "forbidden";
                  }

                  // Prepare data for Pinecone
                  const vectorData = prepareclaimForPinecone(
                    scope,
                    nutrientName,
                    claimText,
                    claimType,
                    totalClaims
                  );
                  
                  allVectorData.push(vectorData);
                  totalClaims++;
                });
            }
          });
      });
      
      console.log(`${scope} scraped successfully - found ${totalClaims} total claims so far`);
    } catch (error) {
      console.error(`Error scraping ${url}: ${error.message}`);
    }

    await sleep(10000);
  }

  console.log(`Scraped ${totalClaims} total claims from ${SCOPES_OF_APPLICATIONS.length} scopes`);
  console.log("Starting to store data in Pinecone...");
  
  try {
    await batchStoreToPinecone(PINECONE_INDEX_NAME, allVectorData);
    console.log("All data has been successfully stored in Pinecone!");
  } catch (error) {
    console.error("Error storing data to Pinecone:", error);
  }
}

console.log("Starting scraping and storing to Pinecone...");
await scrapeData();
console.log("Scraping and Pinecone storage completed!");
