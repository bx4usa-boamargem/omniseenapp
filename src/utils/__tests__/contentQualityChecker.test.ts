import { describe, it, expect } from 'vitest';
import { checkContentQuality } from '../contentQualityChecker';

describe('checkContentQuality', () => {
  it('should be importable and callable', () => {
    expect(typeof checkContentQuality).toBe('function');
  });

  it('should return quality metrics for valid content', () => {
    const longContent = 'Lorem ipsum dolor sit amet. '.repeat(100);
    const result = checkContentQuality(longContent);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should handle empty content', () => {
    const result = checkContentQuality('');
    expect(result).toBeDefined();
  });
});
