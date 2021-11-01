// note: first organize photo assets in a folder, named according to their token ID
// (e.g. 1.png, 2.png, 3.png, etc.)
// and then run:
// arkb deploy arweave-test --use-bundler https://node1.bundlr.network
// to deploy those assets to arweave
// take the resulting data base url & sub in to the value of the constant below

const fs = require('fs')

const PHOTO_BASE_URI = "https://arweave.net/yd87agVBoAGgneJ95QFyj1H_Xkk_CefZwLhYTNH1NlI"

const OUTPUT_FOLDER = "/tmp/metadata_upload/";

const MAX_TOKEN_ID = 10000

async function main() {
  for (var i = 1; i < MAX_TOKEN_ID + 1; i++) {
    let metadataJson = {
        "name":  "Blank NFT",
        "description": "In the beginning, there was Blank.",
        "tokenId": i,
        "image": PHOTO_BASE_URI, // in the future you may have to append "+ i.toString() + ".png""
        "attributes": [{
          "trait_type": "Generation",
          "value": "The beginning"
    }]};
    fs.writeFileSync(OUTPUT_FOLDER + i.toString() + ".json", JSON.stringify(metadataJson), function(err) {
      if (err) {
        console.log(err);
      }
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });