const { readFileSync, writeFileSync, appendFileSync } = require("fs");
const moment = require("moment");
const { exec } = require("shelljs");

const package = readFileSync("./package.json", "utf-8");
const versionLineMatch = package.match(/version[^,]*/);
if (Array.isArray(versionLineMatch)) {
  const versionLine = versionLineMatch[0];
  const nextVersion = +versionLine.match(/.d*"$/)[0].replace(/\D/g, "") + 1;
  const newVersionLine = versionLine.replace(/.d*"$/, `${nextVersion}"`);
  const newPackage = package.replace(versionLine, newVersionLine);

  appendFileSync("./README.MD", `${newVersionLine.replace(/[^\d^.]/g, "")}: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);
  writeFileSync("./package.json", newPackage);

  exec("npm publish");
  exec("git status");
  exec("git add .");
  exec(`git commit -m "update: 更新迭代"`);
  exec(`git push origin master`);
}
