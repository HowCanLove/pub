const { readFileSync, writeFileSync, appendFileSync } = require("fs");
const moment = require("moment");
const { exec } = require("shelljs");
const readline = require("readline-sync");

const package = readFileSync("./package.json", "utf-8");
const versionLineMatch = package.match(/version[^,]*/);
if (Array.isArray(versionLineMatch)) {
  const versionLine = versionLineMatch[0];
  const nextVersion = +versionLine.match(/.d*"$/)[0].replace(/\D/g, "") + 1;
  const newVersionLine = versionLine.replace(/.d*"$/, `${nextVersion}"`);
  const newPackage = package.replace(versionLine, newVersionLine);

  const updateCommit = readline.question("更新内容(代码更新): ") || "代码更新";

  appendFileSync("./README.MD", `\n${newVersionLine.replace(/[^\d^.]/g, "")}: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n`);
  appendFileSync("./README.MD", `\n更新内容: ${updateCommit}\n`);
  writeFileSync("./package.json", newPackage);

  exec("npm publish");
  exec("git status");
  exec("git add .");
  exec(`git commit -m "${updateCommit}"`);
  exec(`git push origin master`);
}
