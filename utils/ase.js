const crypto = require("crypto");

const key = Buffer.from("9vApxLk5G3PAsJrM", "utf8");
const iv = Buffer.from("FnJL7EDzjqWjcaY9", "utf8");

// 加密
function aseEncode(src) {
  let sign = "";
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  sign += cipher.update(src, "utf8", "hex");
  sign += cipher.final("hex");
  return sign;
}

// 解密
function aseDecode(sign) {
  try {
    let src = "";
    const cipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    src += cipher.update(sign, "hex", "utf8");
    src += cipher.final("utf8");
    return src;
  } catch (error) {
    return "aseDecode Error";
  }
}
module.exports = {
  aseEncode,
  aseDecode,
};
