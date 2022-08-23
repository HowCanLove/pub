import { readFileSync, writeFileSync, appendFileSync } from "fs";
import moment from "moment";
import shell from "shelljs";
import inquirer from "inquirer";

const { exec } = shell;
const promptList = [
  {
    type: "input",
    message: "更新内容:",
    name: "updateCommit",
  },
];

async function pub() {
  const packageResult = readFileSync("./package.json", "utf-8");
  const versionLineMatch = packageResult.match(/version[^,]*/);
  if (Array.isArray(versionLineMatch)) {
    const versionLine = versionLineMatch[0];
    const nextVersion = +versionLine.match(/.d*"$/)[0].replace(/\D/g, "") + 1;
    const newVersionLine = versionLine.replace(/.d*"$/, `${nextVersion}"`);
    const newPackage = packageResult.replace(versionLine, newVersionLine);

    const { updateCommit } = await inquirer.prompt(promptList);
    if (updateCommit) {
      appendFileSync("./README.MD", `${newVersionLine.replace(/[^\d^.]/g, "")}: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n`);
      appendFileSync("./README.MD", `更新内容: ${updateCommit}\n`);
    }
    writeFileSync("./package.json", newPackage);

    exec("npm publish");
    exec("git status");
    exec("git add .");
    exec(`git commit -m "${updateCommit || "update"}"`);
    exec(`git push origin master`);
  }
}
pub();
