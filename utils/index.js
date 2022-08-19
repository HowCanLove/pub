const shell = require("shelljs");
const path = require("path");
const fs = require("fs");

// cmd打印 来点点效果
const log = (text) => {
  shell.echo("\n");
  shell.echo("\033[" + (((Math.random() * 7) | 0) + 41) + ";31m " + text + " \033[0m");
};

// 等待 *ms
const wait = (time = 500) => new Promise((resolve) => setTimeout(resolve, time));

// 读取文件夹内的文件
function readdir(dirPath) {
  const newDirPath = path.resolve(__dirname, dirPath);
  return fs
    .readdirSync(newDirPath)
    .map((i) => {
      const currentPath = path.resolve(newDirPath, i);
      let file = fs.statSync(currentPath);
      if (file.isFile()) {
        return currentPath;
      } else if (file.isDirectory()) {
        return readdir(currentPath);
      }
    })
    .filter(Boolean)
    .flat(Infinity);
}

// 上传文件
function put(client, file, { uploadPath, branch }) {
  try {
    // 填写OSS文件完整路径和本地文件的完整路径。OSS文件完整路径中不能包含Bucket名称。
    // 如果本地文件的完整路径中未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
    // console.log(`/dev/${branch}/${file.split("build/").pop()}`.replace(/\s/g, ""));
    // console.log(`${uploadPath}/${branch}/${file.split("build/").pop()}`.replace(/\s/g, ""));
    return client.put(`${uploadPath}/${branch}/${file.split("build/").pop()}`.replace(/\s/g, ""), path.normalize(file));
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
  put,
  log,
  wait,
  readdir,
};
