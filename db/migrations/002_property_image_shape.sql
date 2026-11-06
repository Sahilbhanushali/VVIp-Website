-- Gallery tile shape per property image (editable in the property manager).
ALTER TABLE property_images ADD COLUMN shape ENUM('std','wide','tall') NOT NULL DEFAULT 'std' AFTER category;
