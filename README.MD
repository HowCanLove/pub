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
// onlyBranch false 是否只包含版本号，否的话，上传其中的路径是 daily/x.x.x或者 feature/x.x.x，如果设置为true，则上传其中的版本路径为x.x.x
// uploadPath bucket下的地址
// pushCode 每次执行前是否需要检查代码提交，false->不提交,true->提交
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

## 更新备注
  
0.0.111 ---------- 2023-02-21 11:11:34  
更新内容: 提交内容可以不写前缀，会自动增加 update: 的前缀  
0.0.113 ---------- 2023-03-22 17:30:00  
更新内容: 增加onlyBranch字段  
0.0.116 ---------- 9/27/2024, 2:58:13 PM  
更新内容: 可以选择不提交代码，直接发布  
0.0.117 ---------- 5/28/2025, 10:06:58 AM  
更新内容: 增加pushCode  
0.0.121 ---------- 6/27/2025, 10:55:18 AM  
更新内容: 如果ossKey里包含了 branch字段，则使用osskey文件里的  
