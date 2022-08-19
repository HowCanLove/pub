```bash
npm i -g project-pub
```
在项目中执行 pub
会自动执行npm run build，并将打包后的文件上传至oss。

首次执行 根据代码提示生成 .osskey 文件，并自动添加到 .gitignore。
accessKeyId 与 accessKeySecret会加密保存在本地。
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

未来会增加不同环境的发布
