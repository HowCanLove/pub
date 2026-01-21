#!/usr/bin/env node
import OSS from "ali-oss";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import shell from "shelljs";

import { aseDecode, aseEncode } from "../utils/ase.js";
import { log, put, readdir } from "../utils/index.js";
import ProgressBar from "../utils/progress-bar.js";

const { exec, echo } = shell;
const type = (process.argv[2] || "").replace(/^-/, "");

let client;
let branch = "";
let resultDir = "";
let uploadPath = "";

const createOssKeyList = [
  {
    type: "input",
    message: "输入region:",
    name: "region",
    default: "oss-cn-hangzhou",
  },
  {
    type: "input",
    message: "输入accessKeyId:",
    name: "accessKeyId",
  },
  {
    type: "input",
    message: "输入accessKeySecret:",
    name: "accessKeySecret",
  },
  {
    type: "input",
    message: "输入bucket:",
    name: "bucket",
  },
  {
    type: "input",
    message: "文件上传路径:",
    name: "uploadPath",
    default: "/",
  },
  {
    type: "confirm",
    message: "oss文件上传路径是否仅包含版本号，Y：x.x.x，N: 您完整的分支号 || feature/x.x.x || daily/x.x.x",
    name: "onlyBranch",
    default: false,
  },
  {
    type: "confirm",
    message: "每次执行前是否需要检查代码提交，false表示不提交",
    name: "pushCode",
    default: true,
  },
  {
    type: "input",
    message: "buildDir:",
    name: "buildDir",
    default: "build",
  },
];

// 需要加密的2个字段
const encryptionList = ["accessKeyId", "accessKeySecret"];
async function init() {
  try {
    exec("git branch");
    const dir = exec("pwd");
    const currentDir = dir.trim();
    // 判断 osskey 是否存在, 并且已经被配置过
    const accessKeyPath = path.resolve(currentDir + `/.ossKey${type ? `-${type}` : ""}`);
    const accessFile = fs.existsSync(accessKeyPath);
    if (!accessFile) {
      log("将创建 osskey 文件，您输入的内容会被加密保存在本地");

      const { region, accessKeyId, accessKeySecret, bucket, uploadPath, buildDir, onlyBranch } = await inquirer.prompt(createOssKeyList);

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
      // bucket 前后不能有 /
      let newBucket = bucket.replace(/^\//, "").replace(/\/$/, "");
      let text = `region=${region}\n`;
      text += `accessKeyId=${aseEncode(accessKeyId)}\n`;
      text += `accessKeySecret=${aseEncode(accessKeySecret)}\n`;
      text += `bucket=${newBucket}\n`;
      text += `buildDir=${buildDir.replace("/", "")}\n`;
      text += `onlyBranch=${onlyBranch ? 'true' : 'false'}\n`;
      text += `uploadPath=${uploadPath === "/" ? "/" : uploadPath.replace(/\/+$/, "")}\n`;

      let resultUploadPath = uploadPath.replace(/^\//, "").replace(/\/$/, "");
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          message: `设置完成后，待编译结束，会将 ${buildDir || "build"} 文件夹的内容 上传至 /${newBucket}${resultUploadPath ? `/${resultUploadPath}/` : ""}分支名 下`,
          name: "confirm",
        },
      ]);
      if (!confirm) return;

      fs.writeFileSync(accessKeyPath, text);
      log("osskey 文件 创建成功");

      // 将文件增加到gitignore里，防止提交到线上造成数据泄漏
      const gitignorePath = path.resolve(currentDir + "/.gitignore");
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
      if (!gitignoreContent.includes(".ossKey")) {
        fs.appendFileSync(gitignorePath, "\n.ossKey*\n");
      }
      log("osskey 文件 已被git忽略，如果有需要可以自行从gitignore删除");
    }
    const resultStr = fs.readFileSync(accessKeyPath, "utf-8") || "";
    const projectConfig = Object.fromEntries(
      resultStr
        .split("\n")
        .filter(Boolean)
        .map((i) => i.split("="))
    );

    // 如果oss配置文件被更改，则删掉文件，重新执行 def
    const errorOssConfig = Object.keys(projectConfig).find((key) => projectConfig[key] === "aseDecode Error");

    if (errorOssConfig) {
      fs.unlinkSync(accessKeyPath);
      log("oss 配置出现异常，已将.ossKey文件删除，请重新执行命令");
      return;
    } else {
      const ossConfig = {...projectConfig};
      resultDir = ossConfig.buildDir;
      delete ossConfig.buildDir;
      uploadPath = ossConfig.uploadPath.replace(/^\//, "").replace(/\/$/, "");
      delete ossConfig.uploadPath;
      Object.keys(projectConfig).forEach((key) => {
        if (encryptionList.includes(key)) {
          ossConfig[key] = aseDecode(projectConfig[key]);
        }
      })
      client = new OSS(ossConfig);
    }

    branch = exec("git rev-parse --abbrev-ref HEAD");

    if (projectConfig.pushCode !== "false") {
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
        let { updateCommit } = await inquirer.prompt([
          {
            type: "input",
            message: "新内容:",
            name: "updateCommit",
            default: "update: 样式更新",
          },
        ]);
        // 判断更新内容是否带有前缀，没有前缀的话增加update: 前缀
        if (!/[a-z,A-Z]+[\:：]/.test(updateCommit)) {
          updateCommit = "update: " + updateCommit;
        }
        exec("git add .");
        exec(`git commit -m "${updateCommit.replace(/：/g, ":")}"`);
      }
      const pullResult = exec(`git pull origin ${branch}`);
      if (pullResult.includes("Merge conflict")) {
        log("代码中有冲突，请先解决");
        return;
      }
      exec(`git push origin ${branch}`);
    }

    if(projectConfig.onlyBranch === "true") {
      branch = branch.replace(/[^\d\.]+/g, '')
    }
    if (projectConfig.branch) {
      branch = projectConfig.branch;
    }
    branch = branch.trim();

    const publishTimeKey = `publishTime-${branch}`;
    //  上次发布的时间
    const lastPublishTime = +(projectConfig[publishTimeKey] ?? 0);

    log("开始build");
    exec("npm run build");
    log("build结束");

    const files = [];
    const allFiles = readdir(currentDir + "/" + resultDir);
    for (let i = 0; i < allFiles.length; i++) {
      const stat = fs.statSync(allFiles[i]);
      const time = stat.mtime.getTime();
      // 对比文件的修改时间和上次修改的时间，只上传有修改的文件
      if (time > lastPublishTime) {
        files.push(allFiles[i]);
      }
    }
    const total = files.length;
    echo("\n");
    var bar = new ProgressBar("上传进度", 50);
    log(`准备上传到oss 总共${total}个文件`);
    let uploadCount = 0;
    const uploadPromises = files.map((i) => {
      return put(client, i, { uploadPath, branch, resultDir }).then(res => {
        bar.render({ completed: ++uploadCount, total: total });
        return res;
      })
    });
    await Promise.all(uploadPromises);

    if (resultStr.match(/publishTime-[^\n]+/)) {
      fs.writeFileSync(accessKeyPath, resultStr.replace(/publishTime-[^\n]+/, `${publishTimeKey}=${Date.now()}`));
    } else {
      fs.writeFileSync(accessKeyPath, `${resultStr.trimEnd()}\n${publishTimeKey}=${Date.now()}`);
    }
    echo("\n");
    const list = files.map((i) => `https://${projectConfig.bucket}.${projectConfig.region}.aliyuncs.com/${uploadPath}/${branch ? `${branch}/` : ''}${i.split(`${resultDir}/`).pop()}`.replace(/\s/g, "")).join("\n");
    echo(list);
    echo("\n");
    log("发布结束");
  } catch (error) {
    log(error);
  }
}
init();
