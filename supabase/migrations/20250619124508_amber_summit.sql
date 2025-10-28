/*
  # Add Banner Settings for Admin Management

  1. New Settings
    - Add banner image settings for homepage hero section
    - Add banner image settings for steps section
    - Add banner text settings for customization

  2. Security
    - Only admins can modify these settings
    - Settings are publicly readable for display
*/

-- Insert banner settings
INSERT INTO admin_settings (key, value, description) VALUES
  ('hero_banner_image', 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg', 'Main hero banner image URL for homepage'),
  ('hero_banner_image_alt', 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg', 'Alternative hero banner image URL for homepage'),
  ('steps_banner_image', 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg', 'Steps section banner image URL for homepage'),
  ('hero_title', 'The Ultimate Digital Services & E-commerce Platform.', 'Main hero section title text'),
  ('hero_subtitle', 'Pay bills, shop online, and manage your digital life all in one secure platform.', 'Main hero section subtitle text'),
  ('steps_title', '3 Simple Steps to Enjoy ArabNetwork.', 'Steps section title text')
ON CONFLICT (key) DO NOTHING;