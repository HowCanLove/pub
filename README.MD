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

可以带参数发布，比如 pub d、pub o，就会生成对应的 .osskey-\* 的文件，执行命令会寻找对应的文件，您也可以复制一个文件出来，在发布命令的时候使用。

##版本更新时间

0.0.6: 2022-08-20 16:39:41
0.0.7: 2022-08-22 16:14:37

更新内容: 代码自动提交，遇到冲突自动暂停
