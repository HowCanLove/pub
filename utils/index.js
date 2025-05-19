import shell from "shelljs";
import path from "path";
import fs from "fs";

// cmd打印 来点点效果
export const log = (text) => {
  shell.echo("\n");
  shell.echo(text);
};

// 等待 *ms
export const wait = (time = 500) => new Promise((resolve) => setTimeout(resolve, time));

// 读取文件夹内的文件
export function readdir(dirPath) {
  const newDirPath = path.resolve(dirPath);
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
export function put(client, file, { uploadPath, branch, resultDir = "build" }) {
  try {
    // 填写OSS文件完整路径和本地文件的完整路径。OSS文件完整路径中不能包含Bucket名称。
    // 如果本地文件的完整路径中未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
    // console.log(resultDir);
    // console.log(`/dev/${branch}/${file.split("build/").pop()}`.replace(/\s/g, ""));
    // console.log(`${uploadPath}/${branch}/${file.split(`${resultDir}/`).pop()}`.replace(/\s/g, ""));
    return client.put(`${uploadPath}/${branch}/${file.split(`${resultDir}/`).pop()}`.replace(/\s/g, ""), path.normalize(file));
  } catch (e) {
    console.log(e);
  }
}

export default {};
