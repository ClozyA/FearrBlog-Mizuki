---
title: Ant Design Pro 无法使用umi-ui解决办法
published: 2024-08-29
description: '解决办法'
image: ''
tags: ["Ant Design Pro","Vue"]
category: '学习'
draft: false 
lang: 'zh_CN'
---


## 解决方案步骤

#### 1. 确保 Node.js 版本为 16

首先，请确保你的 Node.js 版本为 16。如果当前版本过高，可能会导致兼容性问题。

安装并使用 [NVM](https://github.com/nvm-sh/nvm)（Node Version Manager），可以方便地切换 Node.js 版本。

```
nvm install 16

nvm use 16
```

#### 2. 安装 Ant Design Pro CLI

在确定了合适的 Node.js 版本后，安装旧版本的 Ant Design Pro CLI。运行以下命令：

```
npm install -g @ant-design/pro-cli@3.1.0
```

你可以通过以下命令来确认安装的 CLI 版本：

```
pro -v
```

#### 3. 创建项目

使用以下命令创建一个新的项目：

```
pro create myapp
```

> 注意：`myapp` 是项目名称，可以替换为你喜欢的名字。

在创建项目时，请务必选择 `umi@3` 版本。 `umi@4` 版本不支持。

#### 4. 安装 UMI 插件

进入项目根目录（例如 `cd myapp`），然后在 WebStorm 等开发工具中以管理员模式执行以下命令：

```
yarn add @umijs/preset-ui -D
```

> 如果你没有安装 `yarn`，或者在执行命令时遇到错误，可以自行解决（通常很容易解决），也可以探索其他安装 `umijs/preset-ui` 的方法。

#### 5. 安装项目依赖

根据你使用的包管理工具，运行以下命令来安装项目依赖：

- 使用 `npm`：

```
npm install
```

- 使用 `yarn`：

```
yarn install
```

> 这一步非常重要，缺少依赖将会导致项目运行错误。

#### 6. 优化 `package.json`

打开项目的 `package.json` 文件，找到以下行：

```
"start": "cross-env UMI_ENV=dev umi dev"
```