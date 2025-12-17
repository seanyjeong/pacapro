const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/sean/.claude/skills/pptx/scripts/html2pptx');
const path = require('path');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = '정으뜸';
    pptx.title = 'P-ACA + MAXT 소개';
    pptx.subject = '체대입시 학원 통합 관리 솔루션';

    const slidesDir = '/home/sean/pacapro/workspace/ppt-slides';

    const slides = [
        'slide1-title.html',
        'slide2-problem.html',
        'slide3-paca.html',
        'slide4-maxt.html',
        'slide5-value.html',
        'slide6-parent.html',
        'slide7-cta.html'
    ];

    for (const slideFile of slides) {
        console.log(`Processing ${slideFile}...`);
        await html2pptx(path.join(slidesDir, slideFile), pptx);
    }

    const outputPath = '/home/sean/pacapro/workspace/PACA-MAXT-소개.pptx';
    await pptx.writeFile({ fileName: outputPath });
    console.log(`Presentation created: ${outputPath}`);
}

createPresentation().catch(console.error);
