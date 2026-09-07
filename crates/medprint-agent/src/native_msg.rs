//! Chrome / Edge 浏览器扩展 Native Messaging 管道协议实现
//!
//! 协议规范：标准输入/输出中，每个消息体前缀为 4 字节的无符号 32 位整数 (Native-Endian) 表示长度。
//! 彻底绕过浏览器 HTTPS 混合内容限制与本地网络端口占用问题。

use std::io::{self, Read, Write};

pub struct NativeMessagePipe;

impl NativeMessagePipe {
    /// 从标准输入读取一个完整的 JSON 消息
    pub fn read_message() -> io::Result<Option<serde_json::Value>> {
        let mut len_bytes = [0u8; 4];
        match io::stdin().read_exact(&mut len_bytes) {
            Ok(_) => {
                let msg_len = u32::from_ne_bytes(len_bytes) as usize;
                let mut buffer = vec![0u8; msg_len];
                io::stdin().read_exact(&mut buffer)?;
                let json: serde_json::Value = serde_json::from_slice(&buffer)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                Ok(Some(json))
            }
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 向标准输出发送一个 JSON 消息给浏览器扩展
    pub fn send_message(value: &serde_json::Value) -> io::Result<()> {
        let json_bytes = serde_json::to_vec(value)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        let len = json_bytes.len() as u32;
        let len_bytes = len.to_ne_bytes();

        let mut stdout = io::stdout().lock();
        stdout.write_all(&len_bytes)?;
        stdout.write_all(&json_bytes)?;
        stdout.flush()?;
        Ok(())
    }
}
