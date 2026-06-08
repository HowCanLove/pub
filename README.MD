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

## 设置密钥 pub key

```bash
pub key        # 设置 accessKeyId / accessKeySecret
pub key d      # 针对 .ossKey-d 设置（带参数同发布命令）
```

执行后会先让你输入 accessKeyId / accessKeySecret，再选择保存到哪里（两种方式都会加密保存）：

- **环境变量**：把 `ossPubAccessKeyId` / `ossPubAccessKeySecret` 写入当前 shell 的配置文件（自动识别 zsh / bash），值为加密后的密文。写入后需要 `source` 配置文件或重开终端才会生效；若没有写入权限，会把 export 语句打印出来让你手动复制。
- **.ossKey 文件**：把密钥加密写入对应的 .ossKey。

首次执行 `pub` 创建配置时，也会走同样的"设置密钥"流程；如果检测到环境变量里已有 `ossPubAccessKeyId` / `ossPubAccessKeySecret`，则自动跳过、不再要求输入。

## 环境变量

支持通过环境变量提供密钥，便于在 CI 或多个项目间复用，不必把密钥写进每个项目的 .ossKey：

```bash
# 值为加密后的密文，建议用 pub key 生成；如需手动维护请保持与 .ossKey 中相同的加密格式
export ossPubAccessKeyId=<加密后的 accessKeyId>
export ossPubAccessKeySecret=<加密后的 accessKeySecret>
```

取值优先级：**.ossKey 文件优先，其次环境变量**。即 .ossKey 里写了密钥就用 .ossKey 的，没有再回退到环境变量。

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
0.0.122 ---------- 12/24/2025, 5:00:52 PM  
更新内容: 发布只上传打包后有修改的文件  
0.0.128 ---------- 2/5/2026, 4:31:50 PM  
更新内容: 上传队列增加数量限制  
