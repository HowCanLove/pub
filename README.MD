```bash
npm i -g project-pub
```

在项目中执行 pub
会自动执行 npm run build，并将打包后的文件上传至 oss。

首次执行 根据代码提示生成 .osskey 文件，并自动添加到 .gitignore。
accessKeyId 与 accessKeySecret 会加密保存在本地。
如果可以上传至项目，可以自己从 .gitignore 中删除。

```javascript
// osskey的内容示例
// region  oss-cn-hangzhou
// accessKeyId  accessKeyId
// accessKeySecret  accessKeySecret
// bucket  bucketName
// uploadPath bucket下的地址
// buildDir 构建的目录 dist ｜ build
```

可以带参数发布，比如 pub d、pub o，就会生成对应的 .osskey-\* 的文件，执行命令会寻找对应的文件，不存在则会创建。

##版本更新时间
0.0.9: 2022-08-22 16:15:49
更新内容: 代码自动提交，遇到冲突自动暂停
0.0.10: 2022-08-22 19:36:50
更新内容: 代码重构，使用 module 格式。
0.0.12: 2022-08-23 09:31:09
更新内容: 去掉了默认值的空括号
0.0.17: 2022-08-23 17:08:33
更新内容: 增加keyworks
