// 屏蔽传递依赖 agentkeepalive(ali-oss) 触发的 util._extend 弃用告警，
// 它无害但会污染命令行交互输出。只精准屏蔽这一条，不影响其他告警。
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (
    name === "warning" &&
    data &&
    data.name === "DeprecationWarning" &&
    /util\._extend/.test(data.message)
  ) {
    return false;
  }
  return originalEmit.apply(process, [name, data, ...args]);
};

export default {};
