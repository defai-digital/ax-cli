#!/usr/bin/env node
/**
 * Example: Comprehensive Project Analysis
 *
 * Analyzes a codebase using all available analyzers and generates
 * a comprehensive quality report.
 *
 * Usage:
 *   npx tsx examples/analyze-project.ts [directory]
 */

import {
  DependencyAnalyzer,
  CodeSmellAnalyzer,
  GitAnalyzer,
  MetricsAnalyzer,
  SecurityAnalyzer,
} from '../src/analyzers/index.js';
import { writeFileSync } from 'fs';
import path from 'path';

async function analyzeProject(directory: string) {
  console.log(`🔍 Analyzing project: ${directory}\n`);

  const report: string[] = [];
  report.push(`# Code Quality Report\n`);
  report.push(`**Project**: ${directory}`);
  report.push(`**Date**: ${new Date().toISOString()}\n`);
  report.push(`---\n`);

  // 1. Dependency Analysis
  console.log('📦 Analyzing dependencies...');
  try {
    const depAnalyzer = new DependencyAnalyzer();
    const depResult = await depAnalyzer.analyzeDependencies(directory, '**/*.{ts,tsx,js,jsx}', {
      includeNodeModules: false,
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**', '**/build/**'],
    });

    report.push(`## 📦 Dependency Analysis\n`);
    report.push(`- **Total Files**: ${depResult.summary.totalFiles}`);
    report.push(`- **Total Dependencies**: ${depResult.summary.totalDependencies}`);
    report.push(`- **Circular Dependencies**: ${depResult.summary.circularDependencyCount}`);
    report.push(`- **Health Score**: ${depResult.summary.healthScore}/100\n`);

    if (depResult.circularDependencies.length > 0) {
      report.push(`### 🔄 Circular Dependencies\n`);
      for (const dep of depResult.circularDependencies.slice(0, 5)) {
        report.push(`- **${dep.severity}**: ${dep.cycle.join(' → ')}`);
      }
      report.push('');
    }

    if (depResult.hubFiles.length > 0) {
      report.push(`### 🌟 Hub Files (High Coupling)\n`);
      for (const file of depResult.hubFiles.slice(0, 5)) {
        report.push(`- ${file}`);
      }
      report.push('');
    }
  } catch (error) {
    report.push(`⚠️ Dependency analysis failed: ${(error as Error).message}\n`);
  }

  // 2. Code Smell Detection
  console.log('👃 Detecting code smells...');
  try {
    const smellAnalyzer = new CodeSmellAnalyzer();
    const smellResult = await smellAnalyzer.analyze(directory, '**/*.{ts,tsx,js,jsx}', {
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    });

    report.push(`## 👃 Code Smell Analysis\n`);
    report.push(`- **Total Smells**: ${smellResult.summary.totalSmells}`);
    report.push(`- **Files Analyzed**: ${smellResult.summary.filesAnalyzed}`);
    report.push(`- **Files with Smells**: ${smellResult.summary.filesWithSmells}`);
    report.push(`- **Health Score**: ${smellResult.summary.codeHealthScore}/100\n`);

    const criticalSmells = smellResult.smells.filter(s => s.severity === 'CRITICAL');
    if (criticalSmells.length > 0) {
      report.push(`### ⚠️ Critical Smells\n`);
      for (const smell of criticalSmells.slice(0, 10)) {
        report.push(`- **${smell.type}** in ${smell.filePath}:${smell.startLine}`);
        report.push(`  ${smell.message}`);
      }
      report.push('');
    }
  } catch (error) {
    report.push(`⚠️ Code smell analysis failed: ${(error as Error).message}\n`);
  }

  // 3. Hotspot Analysis (if git repo)
  console.log('🔥 Analyzing code hotspots...');
  try {
    const gitAnalyzer = new GitAnalyzer(directory);
    const hotspotResult = await gitAnalyzer.analyze({
      since: '6 months ago',
      excludePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    });

    report.push(`## 🔥 Code Hotspot Analysis\n`);
    report.push(`- **Total Commits**: ${hotspotResult.summary.totalCommits}`);
    report.push(`- **Hotspots Found**: ${hotspotResult.summary.hotspotCount}`);
    report.push(`- **Top Contributor**: ${hotspotResult.summary.topContributor}\n`);

    const criticalHotspots = hotspotResult.hotspots.filter(h => h.severity === 'CRITICAL');
    if (criticalHotspots.length > 0) {
      report.push(`### 🚨 Critical Hotspots\n`);
      for (const hotspot of criticalHotspots.slice(0, 5)) {
        report.push(`- **${hotspot.filePath}** (Score: ${hotspot.hotspotScore}/100)`);
        report.push(`  ${hotspot.reason}`);
        report.push(`  _Recommendation: ${hotspot.recommendation}_`);
      }
      report.push('');
    }
  } catch (error) {
    report.push(`⚠️ Hotspot analysis skipped: ${(error as Error).message}\n`);
  }

  // 4. Metrics Analysis
  console.log('📊 Calculating metrics...');
  try {
    const metricsAnalyzer = new MetricsAnalyzer();
    const metricsResult = await metricsAnalyzer.analyze(directory, '**/*.{ts,tsx,js,jsx}', {
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
      includeTests: false,
    });

    report.push(`## 📊 Code Metrics\n`);
    report.push(`- **Files Analyzed**: ${metricsResult.summary.totalFiles}`);
    report.push(`- **Average Complexity**: ${metricsResult.summary.averageComplexity.toFixed(2)}`);
    report.push(`- **Average Maintainability**: ${metricsResult.summary.averageMaintainability.toFixed(2)}/100\n`);

    const poorMaintainability = metricsResult.fileMetrics.filter(
      m => m.maintainability.rating === 'D' || m.maintainability.rating === 'F'
    );

    if (poorMaintainability.length > 0) {
      report.push(`### ⚠️ Poor Maintainability (D/F Rating)\n`);
      for (const file of poorMaintainability.slice(0, 10)) {
        report.push(`- **${file.filePath}** (${file.maintainability.rating}: ${file.maintainability.score.toFixed(1)})`);
        report.push(`  Complexity: ${file.complexity.cyclomaticComplexity}, LOC: ${file.loc}`);
      }
      report.push('');
    }
  } catch (error) {
    report.push(`⚠️ Metrics analysis failed: ${(error as Error).message}\n`);
  }

  // 5. Security Analysis
  console.log('🔒 Analyzing security...');
  try {
    const securityAnalyzer = new SecurityAnalyzer();
    const securityResult = await securityAnalyzer.analyze(directory, '**/*.{ts,tsx,js,jsx}', {
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    });

    report.push(`## 🔒 Security Analysis\n`);
    report.push(`- **Total Vulnerabilities**: ${securityResult.summary.totalVulnerabilities}`);
    report.push(`- **Critical**: ${securityResult.summary.criticalCount}`);
    report.push(`- **High**: ${securityResult.summary.highCount}`);
    report.push(`- **Medium**: ${securityResult.summary.mediumCount}\n`);

    const criticalVulns = securityResult.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    if (criticalVulns.length > 0) {
      report.push(`### 🚨 Critical Vulnerabilities\n`);
      for (const vuln of criticalVulns.slice(0, 10)) {
        report.push(`- **${vuln.type}** in ${vuln.filePath}:${vuln.lineNumber}`);
        report.push(`  ${vuln.message}`);
        report.push(`  _Fix: ${vuln.recommendation}_`);
      }
      report.push('');
    }
  } catch (error) {
    report.push(`⚠️ Security analysis failed: ${(error as Error).message}\n`);
  }

  // Save report
  const reportPath = path.join(directory, 'code-quality-report.md');
  const reportContent = report.join('\n');
  writeFileSync(reportPath, reportContent);

  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(reportContent);
}

// Run if called directly
const directory = process.argv[2] || process.cwd();
analyzeProject(directory).catch(console.error);
