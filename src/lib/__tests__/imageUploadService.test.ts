/**
 * Property-Based Tests for Image Upload Service
 * **Feature: multi-vendor-marketplace, Property 4a: Image Upload Validation**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateImageFile, IMAGE_CONSTANTS } from '../imageUploadService';

const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = IMAGE_CONSTANTS;

/**
 * Helper to create a mock File object for testing
 */
function createMockFile(type: string, size: number, name = 'test.jpg'): File {
  // Create a blob with the specified size
  const content = new Uint8Array(size);
  const blob = new Blob([content], { type });
  
  // Create a File from the blob
  return new File([blob], name, { type });
}

describe('Image Upload Validation - Property Tests', () => {
  /**
   * **Feature: multi-vendor-marketplace, Property 4a: Image Upload Validation**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any image upload attempt, if the file type is not jpg/png/webp
   * or file size exceeds 5MB, the upload SHALL be rejected.
   */
  describe('Property 4a: Image Upload Validation', () => {
    it('should accept valid image files (valid type and size <= 5MB)', () => {
      // Generator for valid MIME types
      const validMimeType = fc.constantFrom(...ALLOWED_MIME_TYPES);
      
      // Generator for valid file sizes (1 byte to 5MB)
      const validFileSize = fc.integer({ min: 1, max: MAX_FILE_SIZE });

      fc.assert(
        fc.property(validMimeType, validFileSize, (mimeType, size) => {
          const file = createMockFile(mimeType, size);
          const result = validateImageFile(file);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject files with invalid MIME types', () => {
      // Generator for invalid MIME types (not in allowed list)
      const invalidMimeTypes = [
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'application/pdf',
        'text/plain',
        'application/json',
        'video/mp4',
        'audio/mpeg',
      ];
      const invalidMimeType = fc.constantFrom(...invalidMimeTypes);
      
      // Any file size (valid or invalid)
      const anyFileSize = fc.integer({ min: 1, max: MAX_FILE_SIZE });

      fc.assert(
        fc.property(invalidMimeType, anyFileSize, (mimeType, size) => {
          const file = createMockFile(mimeType, size);
          const result = validateImageFile(file);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('invalid_type');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject files exceeding 5MB regardless of type', () => {
      // Generator for valid MIME types
      const validMimeType = fc.constantFrom(...ALLOWED_MIME_TYPES);
      
      // Generator for file sizes exceeding 5MB (5MB + 1 byte to 10MB)
      const oversizedFileSize = fc.integer({ 
        min: MAX_FILE_SIZE + 1, 
        max: MAX_FILE_SIZE * 2 
      });

      fc.assert(
        fc.property(validMimeType, oversizedFileSize, (mimeType, size) => {
          const file = createMockFile(mimeType, size);
          const result = validateImageFile(file);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('file_too_large');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject files with both invalid type AND oversized', () => {
      // Generator for invalid MIME types
      const invalidMimeType = fc.constantFrom(
        'image/gif',
        'application/pdf',
        'text/plain'
      );
      
      // Generator for oversized files
      const oversizedFileSize = fc.integer({ 
        min: MAX_FILE_SIZE + 1, 
        max: MAX_FILE_SIZE * 2 
      });

      fc.assert(
        fc.property(invalidMimeType, oversizedFileSize, (mimeType, size) => {
          const file = createMockFile(mimeType, size);
          const result = validateImageFile(file);
          
          // Should be rejected (type check happens first)
          expect(result.valid).toBe(false);
          expect(result.error).toBe('invalid_type');
        }),
        { numRuns: 100 }
      );
    });

    it('should accept exactly 5MB files with valid types', () => {
      const validMimeType = fc.constantFrom(...ALLOWED_MIME_TYPES);

      fc.assert(
        fc.property(validMimeType, (mimeType) => {
          const file = createMockFile(mimeType, MAX_FILE_SIZE);
          const result = validateImageFile(file);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject files just over 5MB with valid types', () => {
      const validMimeType = fc.constantFrom(...ALLOWED_MIME_TYPES);

      fc.assert(
        fc.property(validMimeType, (mimeType) => {
          const file = createMockFile(mimeType, MAX_FILE_SIZE + 1);
          const result = validateImageFile(file);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('file_too_large');
        }),
        { numRuns: 100 }
      );
    });
  });
});
