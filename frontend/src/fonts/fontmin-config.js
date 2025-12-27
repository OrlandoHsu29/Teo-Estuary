const Fontmin = require('fontmin');
const fs = require('fs');

// 需要的文本内容
const text = `
正在录音录音完成正在上传上传成功上传失败准备就绪请配置API密钥
密钥已失效服务未启动正在获取句子获取失败网络错误请先录音
正在播放播放完成ERRORRECPLAYSTOP音频数据审核潮汕话数据管理平台音频记录潮语字典管理导出导出数据
，。！？、；：""''（）【】《》#「」
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
`;

const fontmin = new Fontmin()
    .src('./assets/fonts/dotted_songti_v_0_1/DottedSongtiSquareRegular.otf')
    .use(Fontmin.glyph({
        text: text,
        hinting: false         // 优化字体 hinting
    }))
    .use(Fontmin.ttf2eot())    // 转换为 EOT
    .use(Fontmin.ttf2woff())   // 转换为 WOFF
    .use(Fontmin.ttf2svg())    // 转换为 SVG
    .dest('./assets/fonts/dotted_songti_subset/'); // 输出目录

fontmin.run(function (err, files) {
    if (err) {
        console.error('字体子集化失败:', err);
        throw err;
    }

    console.log('字体子集化成功！');
    files.forEach(file => {
        console.log('生成文件:', file.path);
    });
});
