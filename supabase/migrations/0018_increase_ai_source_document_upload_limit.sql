update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
where id = 'private-source-documents';
