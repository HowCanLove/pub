#!/usr/bin/env node
const shell = require("shelljs");
const path = require("path");
const OSS = require("ali-oss");
const fs = require("fs");
const readline = require("readline-sync");

var ProgressBar = require("../utils/progress-bar");
const { aseDecode, aseEncode } = require("../utils/ase");

const { put, readdir, log } = require("../utils");

const { exec, echo } = shell;
const type = (process.argv[2] || "").replace(/^-/, "");

let client;
let branch = "";
let resultDir = "";
let uploadPath = "";

// 需要加密的2个字段
const encryptionList = ["accessKeyId", "accessKeySecret"];
async function init() {
  try {
    exec("git branch");
    const dir = exec("pwd");

    const currentDir = dir.trim();
    // 判断 osskey 是否存在, 并且已经被配置过
    const accessKeyPath = path.resolve(currentDir, `./.ossKey${type ? `-${type}` : ""}`);
    const accessFile = fs.existsSync(accessKeyPath);
    if (!accessFile) {
      log("将创建 osskey 文件，您输入的内容会被加密保存在本地");
      const region = readline.question("region(oss-cn-hangzhou): ") || "oss-cn-hangzhou";
      const accessKeyId = readline.question("accessKeyId: ");
      const accessKeySecret = readline.question("accessKeySecret: ");
      const bucket = readline.question("bucket: ");
      const uploadPath = readline.question("上传至bucket路径(/): ") || "/";
      const buildDir = readline.question("buildDir(build): ") || "build";

      if (!accessKeyId) {
        log("accessKeyId 不能为空");
        return;
      }
      if (!accessKeySecret) {
        log("accessKeySecret 不能为空");
        return;
      }
      if (!bucket) {
        log("bucket 不能为空");
        return;
      }
      let text = `region=${region}\n`;
      text += `accessKeyId=${aseEncode(accessKeyId)}\n`;
      text += `accessKeySecret=${aseEncode(accessKeySecret)}\n`;
      text += `bucket=${bucket}\n`;
      text += `buildDir=${buildDir.replace("/", "")}\n`;
      text += `uploadPath=${uploadPath.replace(/\/+$/, "")}\n`;

      readline.question(`设置完成后，待编译结束，会将 ${buildDir || "build"} 文件夹的内容 上传至 /${bucket}${uploadPath}/分支名 下`);

      fs.writeFileSync(accessKeyPath, text);
      log("osskey 文件 创建成功");

      // 将文件增加到gitignore里，防止提交到线上造成数据泄漏
      const gitignorePath = path.resolve(currentDir, "./.gitignore");
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
      if (!gitignoreContent.includes(".ossKey\n")) {
        fs.appendFileSync(gitignorePath, ".ossKey*\n");
      }
      log("osskey 文件 已被git忽略，如果有需要可以自行从gitignore删除");
    }
    const result = fs.readFileSync(accessKeyPath, "utf-8");
    const ossConfig = Object.fromEntries(
      result
        .split("\n")
        .filter(Boolean)
        .map((i) => {
          let [key, value] = i.split("=");
          if (encryptionList.includes(key)) {
            value = aseDecode(value);
          }
          return [key, value];
        })
    );

    // 如果oss配置文件被更改，则删掉文件，重新执行 def
    const errorOssConfig = Object.keys(ossConfig).find((key) => ossConfig[key] === "aseDecode Error");

    if (errorOssConfig) {
      log("oss 配置出现异常，请重新配置");
      fs.unlinkSync(accessKeyPath);
      exec("def");
      return;
    } else {
      resultDir = ossConfig.buildDir;
      delete ossConfig.buildDir;
      uploadPath = ossConfig.uploadPath;
      if (!uploadPath.startsWith("/")) {
        uploadPath = `/${uploadPath}`;
      }
      delete ossConfig.uploadPath;
      client = new OSS(ossConfig);
    }
    branch = exec("git rev-parse --abbrev-ref HEAD");
    // if (!/^feature\/\d+.\d+.\d+$/.test(branch)) {
    //   log("分支的格式必须为：feature/x.x.x");
    //   return;
    // }
    const gitStatus = exec("git status");
    const checkNeedMerge = gitStatus.includes("git merge --abort");
    if (checkNeedMerge) {
      log("代码中有冲突，请先解决，并提交");
      return;
    }
    const checkNoCommit = gitStatus.includes("nothing to commit");
    if (!checkNoCommit) {
      exec("git add .");
      const updateCommit = readline.question("更新内容(update: 更新): ") || "update: 更新";
      exec(`git commit -m "${updateCommit}"`);
    }
    const pullResult = exec(`git pull origin ${branch}`);
    if (pullResult.includes("Merge conflict")) {
      log("代码中有冲突，请先解决");
      return;
    }
    exec(`git push origin ${branch}`);

    log("开始build");
    exec("npm run build");
    log("build结束");

    const files = readdir(currentDir + "/" + resultDir);
    const total = files.length;

    echo("\n");
    var bar = new ProgressBar("上传进度", 50);
    log(`准备上传到oss 总共${total}个文件`);
    for (let i = 0; i < files.length; i++) {
      await put(client, files[i], { uploadPath, branch });
      bar.render({ completed: i + 1, total: total });
    }
    echo("\n");
    const list = files.map((i) => `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${uploadPath}/${branch}/${i.split("build/").pop()}`.replace(/\s/g, "")).join("\n");
    echo(list);
    echo("\n");
    echo("\033[42;31m" + "发布结束" + " \033[0m");
  } catch (error) {
    log(error);
  }
}
init();
