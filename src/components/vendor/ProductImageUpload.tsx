/**
 * Product Image Upload Component
 * Handles image upload with drag-and-drop, preview, and validation
 * Requirements: 2.5
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { uploadProductImage, validateImageFile } from '../../lib/imageUploadService';

type ProductImageUploadProps = {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  userId: string;
};

const ProductImageUpload: React.FC<ProductImageUploadProps> = ({
  currentImageUrl,
  onImageUploaded,
  userId,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setError(null);

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      if (validation.error === 'invalid_type') {
        setError('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
      } else if (validation.error === 'file_too_large') {
        setError('File too large. Maximum size is 5MB.');
      }
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress (actual upload doesn't provide progress)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      const result = await uploadProductImage(file, userId);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.url) {
        onImageUploaded(result.url);
        setPreviewUrl(result.url);
      } else {
        setError(result.error || 'Failed to upload image');
        setPreviewUrl(currentImageUrl || null);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError('Failed to upload image. Please try again.');
      setPreviewUrl(currentImageUrl || null);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Upload Area */}
      <div
        onClick={!isUploading ? handleClick : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
          isDragging
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
        } ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Product preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            {!isUploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage();
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm">Uploading... {uploadProgress}%</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
              isDragging ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              {isDragging ? (
                <Upload className="w-6 h-6 text-green-600" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {isDragging ? 'Drop image here' : 'Drag and drop an image, or click to select'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              JPG, PNG, or WebP (max 5MB)
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && uploadProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
          <AlertCircle size={14} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Success Indicator */}
      {previewUrl && !isUploading && !error && (
        <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
          <CheckCircle size={14} />
          <span className="text-sm">Image ready</span>
        </div>
      )}
    </div>
  );
};

export default ProductImageUpload;
