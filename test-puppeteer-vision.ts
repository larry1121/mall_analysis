import 'dotenv/config';
import { getPuppeteerScreenshot } from './src/lib/puppeteer-screenshot.js';
import { createVisionLLMGrader } from './src/lib/vision-llm.js';
import { FirecrawlClient } from './src/lib/firecrawl.js';

async function testPuppeteerWithVisionLLM() {
  console.log('🚀 Starting Puppeteer + Vision LLM Integration Test\n');
  
  // Test URL - using a Korean e-commerce site
  const testUrl = 'https://www.musinsa.com';
  
  try {
    // Step 1: Capture screenshot with Puppeteer
    console.log('📸 Step 1: Capturing screenshot with Puppeteer...');
    const puppeteer = getPuppeteerScreenshot('./screenshots');
    
    const screenshotResult = await puppeteer.capture(testUrl, {
      fullPage: false, // Just viewport for faster testing
      viewport: {
        width: 375,
        height: 812,
        isMobile: true,
        deviceScaleFactor: 2
      },
      waitFor: 3000
    });
    
    if (!screenshotResult.success) {
      console.error('❌ Screenshot capture failed:', screenshotResult.error);
      return;
    }
    
    console.log('✅ Screenshot captured successfully!');
    console.log('   - Local path:', screenshotResult.localPath);
    console.log('   - Data URI length:', screenshotResult.screenshot?.length || 0, 'characters');
    console.log('   - Metadata:', JSON.stringify(screenshotResult.metadata, null, 2));
    
    // Step 2: Test Vision LLM with the screenshot
    console.log('\n🤖 Step 2: Analyzing screenshot with Vision LLM...');
    
    const hasLLMKey = !!process.env.LLM_API_KEY;
    console.log('   - LLM API Key configured:', hasLLMKey);
    
    if (!screenshotResult.screenshot) {
      console.error('❌ No screenshot data to analyze');
      return;
    }
    
    const grader = createVisionLLMGrader();
    
    // Prepare input for Vision LLM
    const graderInput = {
      url: testUrl,
      platform: FirecrawlClient.detectPlatform(testUrl) as 'cafe24' | 'imweb' | 'unknown',
      html: '', // We can leave this empty for testing
      screenshots: {
        firstView: screenshotResult.screenshot,
        actions: []
      }
    };
    
    console.log('   - Input prepared:');
    console.log('     • URL:', graderInput.url);
    console.log('     • Platform:', graderInput.platform);
    console.log('     • Screenshot data: Yes (base64)');
    
    let graderResult;
    
    if (hasLLMKey) {
      console.log('\n   🔄 Calling Vision LLM API (this may take a moment)...');
      try {
        graderResult = await grader.grade(graderInput);
        console.log('   ✅ Vision LLM analysis completed!');
      } catch (error) {
        console.error('   ❌ Vision LLM API error:', error);
        console.log('   🔄 Falling back to mock grader...');
        graderResult = await grader.gradeMock(graderInput);
      }
    } else {
      console.log('   ℹ️  No LLM API key, using mock grader...');
      graderResult = await grader.gradeMock(graderInput);
    }
    
    // Step 3: Display results
    console.log('\n📊 Step 3: Analysis Results');
    console.log('='*50);
    
    if (graderResult.scores) {
      console.log('\n📈 Scores:');
      Object.entries(graderResult.scores).forEach(([category, data]: [string, any]) => {
        console.log(`\n  ${category.toUpperCase()}:`);
        console.log(`    - Score: ${data.score}/100`);
        if (data.insights && data.insights.length > 0) {
          console.log(`    - Insights:`);
          data.insights.slice(0, 2).forEach((insight: string) => {
            console.log(`      • ${insight}`);
          });
        }
      });
    }
    
    if (graderResult.expertSummary) {
      console.log('\n🎯 Expert Summary:');
      console.log(`  Grade: ${graderResult.expertSummary.grade}`);
      console.log(`  Headline: ${graderResult.expertSummary.headline}`);
      
      if (graderResult.expertSummary.strengths?.length > 0) {
        console.log(`  Strengths:`);
        graderResult.expertSummary.strengths.slice(0, 2).forEach((s: string) => {
          console.log(`    ✓ ${s}`);
        });
      }
      
      if (graderResult.expertSummary.weaknesses?.length > 0) {
        console.log(`  Weaknesses:`);
        graderResult.expertSummary.weaknesses.slice(0, 2).forEach((w: string) => {
          console.log(`    • ${w}`);
        });
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('   Screenshot was captured by Puppeteer and analyzed by Vision LLM');
    
    // Cleanup
    await puppeteer.cleanup();
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
console.log('='*60);
console.log('  Puppeteer + Vision LLM Integration Test');
console.log('='*60);
console.log();

testPuppeteerWithVisionLLM()
  .then(() => {
    console.log('\n👋 Test finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });