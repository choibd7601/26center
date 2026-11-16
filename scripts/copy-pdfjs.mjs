// pdf.js 워커와 이미지 디코더(wasm)를 public 폴더로 복사 (스캔 PDF 의 CCITT/JBIG2 이미지 해독에 필요)
import fs from "node:fs";
fs.mkdirSync("public/pdfjs-wasm", { recursive: true });
fs.copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
fs.cpSync("node_modules/pdfjs-dist/wasm", "public/pdfjs-wasm", { recursive: true });
