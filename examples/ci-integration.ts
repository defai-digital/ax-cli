#!/usr/bin/env node
/**
 * Example: CI/CD Integration
 *
 * Example script for integrating code analysis into CI/CD pipelines.
 * Fails the build if critical issues are found.
 *
 * Usage:
 *   npx tsx examples/ci-integration.ts [directory]
 *
 * Exit Codes:
 *   0 - Success (no critical issues)
 *   1 - Critical issues found
 *   2 - Analysis error
 */

import {
  DependencyAnalyzer,
  CodeSmellAnalyzer,
  SecurityAnalyzer,
} from '../src/analyzers/index.js';

interface CICheckResult {
  passed: boolean;
  criticalIssues: string[];
  warnings: string[];
}

async function runCIChecks(directory: string): Promise<CICheckResult> {
  const result: CICheckResult = {
    passed: true,
    criticalIssues: [],
    warnings: [],
  };

  console.log('🔍 Running CI/CD quality checks...\n');

  // 1. Dependency Health Check
  console.log('📦 Checking dependency health...');
  try {
    const depAnalyzer = new DependencyAnalyzer();
    const depResult = await depAnalyzer.analyzeDependencies(directory, '**/*.{ts,tsx,js,jsx}', {
      includeNodeModules: false,
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**'],
    });

    const healthScore = depResult.summary.healthScore;
    console.log(`   Health Score: ${healthScore}/100`);

    if (healthScore < 50) {
      result.passed = false;
      result.criticalIssues.push(`Dependency health score too low: ${healthScore}/100`);
    } else if (healthScore < 70) {
      result.warnings.push(`Dependency health score below recommended: ${healthScore}/100`);
    }

    // Check for critical circular dependencies
    const criticalCircular = depResult.circularDependencies.filter(
      d => d.severity === 'critical' || d.severity === 'high'
    );

    if (criticalCircular.length > 0) {
      result.passed = false;
      result.criticalIssues.push(
        `${criticalCircular.length} critical/high circular dependencies found`
      );
    }

    console.log(`   ✓ Circular Dependencies: ${depResult.summary.circularDependencyCount}`);
  } catch (error) {
    console.error(`   ✗ Dependency check failed: ${(error as Error).message}`);
    throw error;
  }

  // 2. Critical Code Smells
  console.log('\n👃 Checking for critical code smells...');
  try {
    const smellAnalyzer = new CodeSmellAnalyzer();
    const smellResult = await smellAnalyzer.analyze(directory, '**/*.{ts,tsx,js,jsx}', {
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    });

    const criticalSmells = smellResult.smells.filter(s => s.severity === 'CRITICAL');
    console.log(`   Critical Smells: ${criticalSmells.length}`);

    if (criticalSmells.length > 0) {
      result.passed = false;
      result.criticalIssues.push(`${criticalSmells.length} critical code smells found`);

      console.log('\n   Critical Issues:');
      for (const smell of criticalSmells.slice(0, 5)) {
        console.log(`   - ${smell.type} in ${smell.filePath}:${smell.startLine}`);
      }
    } else {
      console.log('   ✓ No critical code smells');
    }

    // Check code health score
    const codeHealthScore = smellResult.summary.codeHealthScore;
    if (codeHealthScore < 60) {
      result.passed = false;
      result.criticalIssues.push(`Code health score too low: ${codeHealthScore}/100`);
    } else if (codeHealthScore < 75) {
      result.warnings.push(`Code health score below recommended: ${codeHealthScore}/100`);
    }
  } catch (error) {
    console.error(`   ✗ Code smell check failed: ${(error as Error).message}`);
    throw error;
  }

  // 3. Security Vulnerabilities
  console.log('\n🔒 Checking for security vulnerabilities...');
  try {
    const securityAnalyzer = new SecurityAnalyzer();
    const securityResult = await securityAnalyzer.analyze(directory, '**/*.{ts,tsx,js,jsx}', {
      ignorePatterns: ['**/*.test.ts', '**/*.spec.ts'],
    });

    const criticalVulns = securityResult.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const highVulns = securityResult.vulnerabilities.filter(v => v.severity === 'HIGH');

    console.log(`   Critical: ${criticalVulns.length}, High: ${highVulns.length}`);

    if (criticalVulns.length > 0) {
      result.passed = false;
      result.criticalIssues.push(`${criticalVulns.length} critical security vulnerabilities found`);

      console.log('\n   Critical Vulnerabilities:');
      for (const vuln of criticalVulns.slice(0, 5)) {
        console.log(`   - ${vuln.type} in ${vuln.filePath}:${vuln.lineNumber}`);
      }
    } else {
      console.log('   ✓ No critical vulnerabilities');
    }

    if (highVulns.length > 0) {
      result.warnings.push(`${highVulns.length} high-severity vulnerabilities found`);
    }
  } catch (error) {
    console.error(`   ✗ Security check failed: ${(error as Error).message}`);
    throw error;
  }

  return result;
}

// Main execution
async function main() {
  const directory = process.argv[2] || process.cwd();

  console.log(`\n📁 Analyzing: ${directory}\n`);
  console.log('='.repeat(60) + '\n');

  try {
    const result = await runCIChecks(directory);

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 CI/CD Check Results:\n');

    if (result.criticalIssues.length > 0) {
      console.log('❌ CRITICAL ISSUES:');
      for (const issue of result.criticalIssues) {
        console.log(`   • ${issue}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const warning of result.warnings) {
        console.log(`   • ${warning}`);
      }
    }

    if (result.passed && result.warnings.length === 0) {
      console.log('✅ All checks passed! No issues found.');
      process.exit(0);
    } else if (result.passed) {
      console.log('\n✅ Checks passed with warnings.');
      process.exit(0);
    } else {
      console.log('\n❌ Build failed due to critical issues.');
      console.log('Please fix the critical issues above before deploying.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ CI/CD checks failed with error:');
    console.error((error as Error).message);
    process.exit(2);
  }
}

main();
