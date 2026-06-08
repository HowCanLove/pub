#!/usr/bin/env node
import "../utils/suppress-warning.js";
import OSS from "ali-oss";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import os from "os";
import shell from "shelljs";

import { aseDecode, aseEncode } from "../utils/ase.js";
import { log, put, readdir, asyncPool } from "../utils/index.js";
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
    message: "每次执行前是否检查代码提交(默认false不提交)",
    name: "pushCode",
    default: false,
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

      const { region, bucket, uploadPath, buildDir, onlyBranch, pushCode } = await inquirer.prompt(createOssKeyList);

      if (!bucket) {
        log("bucket 不能为空");
        return;
      }
      // bucket 前后不能有 /
      let newBucket = bucket.replace(/^\//, "").replace(/\/$/, "");
      let text = `region=${region}\n`;
      text += `bucket=${newBucket}\n`;
      text += `buildDir=${buildDir.replace("/", "")}\n`;
      text += `onlyBranch=${onlyBranch ? 'true' : 'false'}\n`;
      text += `pushCode=${pushCode ? 'true' : 'false'}\n`;
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

      // 设置密钥：选择加密保存到环境变量或 .ossKey（已配置环境变量则自动跳过）
      await saveCredential(accessKeyPath, true);

      log("配置已创建完成，再次执行 pub 即可提交代码并打包发布");
      return; // 首次仅创建配置，本次到此结束
    }
    const resultStr = fs.readFileSync(accessKeyPath, "utf-8") || "";
    const projectConfig = Object.fromEntries(
      resultStr
        .split("\n")
        .filter(Boolean)
        .map((i) => i.split("="))
    );

    // 校验必要字段，缺失则直接报错，避免后续读取 undefined 崩溃
    const requiredFields = ["region", "bucket", "buildDir", "uploadPath"];
    const missingFields = requiredFields.filter((key) => !projectConfig[key]);
    if (missingFields.length) {
      log(`.ossKey 缺少必要配置：${missingFields.join("、")}，请补全或删除 .ossKey 后重新执行`);
      return;
    }

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
      // accessKeyId / accessKeySecret：.ossKey 优先，其次环境变量（两者都是加密保存，使用前解密）
      const envEncrypted = {
        accessKeyId: process.env.ossPubAccessKeyId,
        accessKeySecret: process.env.ossPubAccessKeySecret,
      };
      encryptionList.forEach((key) => {
        const encrypted = projectConfig[key] || envEncrypted[key];
        if (encrypted) {
          ossConfig[key] = aseDecode(encrypted);
        } else {
          delete ossConfig[key];
        }
      });
      if (
        !ossConfig.accessKeyId ||
        !ossConfig.accessKeySecret ||
        ossConfig.accessKeyId === "aseDecode Error" ||
        ossConfig.accessKeySecret === "aseDecode Error"
      ) {
        log("未找到有效的 accessKeyId / accessKeySecret，请在 .ossKey 中配置，或执行 pub key 设置环境变量");
        return;
      }
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
        // 转义双引号上下文里的特殊字符，避免提交信息破坏命令
        const safeCommit = updateCommit.replace(/：/g, ":").replace(/([\\"`$])/g, "\\$&");
        exec("git add .");
        exec(`git commit -m "${safeCommit}"`);
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
    const buildResult = exec("npm run build");
    if (buildResult.code !== 0) {
      log("构建失败，已停止发布");
      return;
    }
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
    async function uploadWithLimit() {
      await asyncPool(20, files, (filePath) => {
        return put(client, filePath, { uploadPath, branch, resultDir }).then(res => {
          bar.render({ completed: ++uploadCount, total: total });
          return res;
        })
      });
      console.log("限流并发上传完成");
    }
    await uploadWithLimit();

    // 按「当前分支」精确更新/新增 publishTime 行，避免多分支互相覆盖
    fs.writeFileSync(accessKeyPath, upsertLine(resultStr, publishTimeKey, Date.now()));
    echo("\n");
    const list = files.map((i) => `https://${projectConfig.bucket}.${projectConfig.region}.aliyuncs.com/${uploadPath}/${branch ? `${branch}/` : ''}${i.split(`${resultDir}/`).pop()}`.replace(/\s/g, "")).join("\n");
    echo(list);
    echo("\n");
    log("发布结束");
  } catch (error) {
    log(error);
  }
}

// 在文本中新增或更新 `key=value` 行（key 可能含 . / - 等正则特殊字符，需转义）
function upsertLine(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escapedKey}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, `${key}=${value}`);
  }
  return `${content.replace(/\n*$/, content ? "\n" : "")}${key}=${value}\n`;
}

// 根据当前 shell 找到对应的配置文件
function getShellRcPath() {
  const shellPath = process.env.SHELL || "";
  const home = os.homedir();
  if (shellPath.includes("zsh")) return path.join(home, ".zshrc");
  if (shellPath.includes("bash")) {
    const profile = path.join(home, ".bash_profile");
    return fs.existsSync(profile) ? profile : path.join(home, ".bashrc");
  }
  return path.join(home, ".profile");
}

// 收集 accessKeyId / accessKeySecret，选择加密保存到 .ossKey 或环境变量。
// skipIfEnv=true 时，若已配置环境变量则跳过（用于首次创建配置的流程）。
async function saveCredential(accessKeyPath, skipIfEnv = false) {
  if (skipIfEnv && process.env.ossPubAccessKeyId && process.env.ossPubAccessKeySecret) {
    log("检测到已配置环境变量 ossPubAccessKeyId / ossPubAccessKeySecret，跳过密钥设置");
    return;
  }
  const { accessKeyId, accessKeySecret } = await inquirer.prompt([
    { type: "input", message: "输入accessKeyId:", name: "accessKeyId" },
    { type: "input", message: "输入accessKeySecret:", name: "accessKeySecret" },
  ]);
  if (!accessKeyId || !accessKeySecret) {
    log("accessKeyId 和 accessKeySecret 不能为空");
    return;
  }
  const encId = aseEncode(accessKeyId);
  const encSecret = aseEncode(accessKeySecret);

  const { target } = await inquirer.prompt([
    {
      type: "list",
      message: "密钥保存到哪里？（两种方式都会加密保存）",
      name: "target",
      choices: [
        { name: "环境变量 ossPubAccessKeyId / ossPubAccessKeySecret（写入 shell 配置文件）", value: "env" },
        { name: ".ossKey 文件", value: "ossKey" },
      ],
    },
  ]);

  if (target === "ossKey") {
    let content = fs.existsSync(accessKeyPath) ? fs.readFileSync(accessKeyPath, "utf-8") : "";
    content = upsertLine(content, "accessKeyId", encId);
    content = upsertLine(content, "accessKeySecret", encSecret);
    fs.writeFileSync(accessKeyPath, content);
    log(`已加密保存到 ${accessKeyPath}`);
  } else {
    const rcPath = getShellRcPath();
    let content = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, "utf-8") : "";
    // 去掉同名的旧 export 行，避免重复
    content = content
      .split("\n")
      .filter((line) => !/^\s*export\s+ossPubAccessKey(Id|Secret)=/.test(line))
      .join("\n");
    const exportLines = `export ossPubAccessKeyId=${encId}\nexport ossPubAccessKeySecret=${encSecret}\n`;
    try {
      fs.writeFileSync(rcPath, `${content.replace(/\n*$/, content.trim() ? "\n" : "")}${exportLines}`);
      log(`已加密写入环境变量到 ${rcPath}`);
      log("请执行下面命令或重开终端使其生效：");
      echo(`\nsource ${rcPath}\n`);
    } catch (e) {
      // 没有写入权限等情况，回退为让用户自己复制
      log(`无法写入 ${rcPath}（${e.code || e.message}），请手动把下面两行复制到你的 shell 配置文件，再重开终端：`);
      echo(`\n${exportLines}`);
    }
  }
}

// pub key [type]：单独设置密钥
async function setKey(keyType) {
  try {
    const currentDir = exec("pwd").trim();
    const accessKeyPath = path.resolve(currentDir + `/.ossKey${keyType ? `-${keyType}` : ""}`);
    await saveCredential(accessKeyPath, false);
  } catch (error) {
    log(error);
  }
}

if (type === "key") {
  setKey(process.argv[3] || "");
} else {
  init();
}
