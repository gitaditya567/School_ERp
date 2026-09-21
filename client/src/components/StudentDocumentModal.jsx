import { useState, useRef } from 'react';
import api from '../api/client';
import { Drawer, Chip } from './ui';
import { useToast } from '../context/ToastContext';

/**
 * Compresses an image data URL or file to fit under 600 KB
 */
function processDocumentFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'));

    if (file.type === 'application/pdf') {
      if (file.size > 1.2 * 1024 * 1024) {
        return reject(new Error('PDF file size is over 1.2 MB. Please upload a smaller file.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read PDF file'));
      reader.readAsDataURL(file);
      return;
    }

    if (!/^image\/(png|jpeg|webp|jpg)$/i.test(file.type)) {
      return reject(new Error('Please upload a PDF, PNG, or JPG document.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not parse image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 750 * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function StudentDocumentModal({ student, onClose, onSaved }) {
  const { toast, error: shout } = useToast();
  const [saving, setSaving] = useState(false);

  const [docs, setDocs] = useState({
    birthCertificateSubmitted: Boolean(student?.birthCertificateSubmitted),
    fatherAadhaarSubmitted: Boolean(student?.fatherAadhaarSubmitted),
    motherAadhaarSubmitted: Boolean(student?.motherAadhaarSubmitted),
    birthCertificateDoc: student?.birthCertificateDoc || '',
    fatherAadhaarDoc: student?.fatherAadhaarDoc || '',
    motherAadhaarDoc: student?.motherAadhaarDoc || '',
  });

  const birthInputRef = useRef(null);
  const fatherInputRef = useRef(null);
  const motherInputRef = useRef(null);

  const handleFileUpload = async (key, docKey, file) => {
    if (!file) return;
    try {
      const dataUrl = await processDocumentFile(file);
      setDocs((prev) => ({
        ...prev,
        [docKey]: dataUrl,
        [key]: true, // Automatically mark as submitted when a file is uploaded
      }));
      toast('Document file attached! Click "Save Changes" to apply.');
    } catch (e) {
      shout(e.message || 'Error processing document');
    }
  };

  const removeFile = (docKey) => {
    setDocs((prev) => ({ ...prev, [docKey]: '' }));
  };

  const openDocViewer = (dataUrl, title) => {
    if (!dataUrl) return;
    const win = window.open('');
    if (win) {
      if (dataUrl.startsWith('data:application/pdf')) {
        win.document.write(`
          <html>
            <head><title>${title}</title></head>
            <body style="margin:0;height:100vh;">
              <embed width="100%" height="100%" src="${dataUrl}" type="application/pdf" />
            </body>
          </html>
        `);
      } else {
        win.document.write(`
          <html>
            <head><title>${title}</title></head>
            <body style="margin:0;background:#111;display:grid;place-items:center;height:100vh;">
              <img src="${dataUrl}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);" />
            </body>
          </html>
        `);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/students/${student._id}`, docs);
      toast('Student documents updated successfully!');
      onSaved?.(res.student);
      onClose();
    } catch (e) {
      shout(e);
    } finally {
      setSaving(false);
    }
  };

  const submittedCount =
    (docs.birthCertificateSubmitted ? 1 : 0) +
    (docs.fatherAadhaarSubmitted ? 1 : 0) +
    (docs.motherAadhaarSubmitted ? 1 : 0);

  const allSubmitted = submittedCount === 3;

  const docList = [
    {
      id: 'birthCert',
      title: 'Child Birth Certificate',
      sub: 'Official municipal/panchayat birth certificate copy',
      flagKey: 'birthCertificateSubmitted',
      docKey: 'birthCertificateDoc',
      ref: birthInputRef,
      info: student?.dob ? `DOB: ${new Date(student.dob).toLocaleDateString('en-IN')}` : null,
    },
    {
      id: 'fatherAadhaar',
      title: "Father's Aadhaar Card",
      sub: 'Aadhaar identity card copy of father / guardian',
      flagKey: 'fatherAadhaarSubmitted',
      docKey: 'fatherAadhaarDoc',
      ref: fatherInputRef,
      info: student?.fatherAadhaar ? `Aadhaar: ${student.fatherAadhaar}` : (student?.father ? `Father: ${student.father}` : null),
    },
    {
      id: 'motherAadhaar',
      title: "Mother's Aadhaar Card",
      sub: 'Aadhaar identity card copy of mother',
      flagKey: 'motherAadhaarSubmitted',
      docKey: 'motherAadhaarDoc',
      ref: motherInputRef,
      info: student?.motherAadhaar ? `Aadhaar: ${student.motherAadhaar}` : (student?.mother ? `Mother: ${student.mother}` : null),
    },
  ];

  const footer = (
    <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={save}
        disabled={saving}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span>💾</span> {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
        Close
      </button>
    </div>
  );

  return (
    <Drawer
      title="Student Document Verification"
      sub={`${student?.name} · ${student?.admissionNo} · ${student?.classId?.name || 'Class'}-${student?.section || 'A'}`}
      onClose={onClose}
      footer={footer}
      wide
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Status Summary Banner */}
        <div
          style={{
            background: allSubmitted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${allSubmitted ? '#10b981' : '#f59e0b'}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: allSubmitted ? '#059669' : '#d97706' }}>
              {allSubmitted ? '✓ All Required Documents Submitted' : `⚠️ Document Submission Incomplete (${submittedCount} of 3 Submitted)`}
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {allSubmitted
                ? 'All mandatory identity and registration documents have been verified and recorded.'
                : 'Please verify the pending documents below or attach their digital copy.'}
            </div>
          </div>
          <Chip tone={allSubmitted ? 'paid' : 'due'}>
            {allSubmitted ? 'All Complete' : `${3 - submittedCount} Pending`}
          </Chip>
        </div>

        {/* Document Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {docList.map((item) => {
            const isSubmitted = docs[item.flagKey];
            const hasFile = Boolean(docs[item.docKey]);

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface-2)',
                  border: `1px solid ${isSubmitted ? 'rgba(16, 185, 129, 0.4)' : 'var(--line)'}`,
                  borderRadius: 10,
                  padding: '16px 18px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{item.id === 'birthCert' ? '📄' : '🪪'}</span>
                      <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{item.title}</h4>
                      <Chip tone={isSubmitted ? 'paid' : 'due'}>
                        {isSubmitted ? 'Submitted' : 'Pending'}
                      </Chip>
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4, marginLeft: 26 }}>
                      {item.sub}
                      {item.info && (
                        <span className="mono" style={{ marginLeft: 8, color: 'var(--brand)', fontWeight: 600 }}>
                          · {item.info}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission Checkbox Toggle */}
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isSubmitted ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface)',
                      border: `1px solid ${isSubmitted ? '#10b981' : 'var(--line)'}`,
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSubmitted}
                      onChange={(e) => setDocs({ ...docs, [item.flagKey]: e.target.checked })}
                      style={{ cursor: 'pointer', accentColor: '#10b981', width: 16, height: 16 }}
                    />
                    <span>{isSubmitted ? 'Marked as Submitted' : 'Mark as Submitted'}</span>
                  </label>
                </div>

                {/* Document File Attachment / Upload Area */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {hasFile ? (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span>📎</span> Attached ({docs[item.docKey].startsWith('data:application/pdf') ? 'PDF' : 'Image'})
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => openDocViewer(docs[item.docKey], item.title)}
                          title="Open document in a new window"
                        >
                          👁️ View Document
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: 'var(--crit)' }}
                          onClick={() => removeFile(item.docKey)}
                          title="Remove attached file"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="tiny muted">No digital file attached yet.</span>
                    )}
                  </div>

                  <div>
                    <input
                      ref={item.ref}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        handleFileUpload(item.flagKey, item.docKey, e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => item.ref.current?.click()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <span>📁</span> {hasFile ? 'Replace Document File' : 'Upload Document (PDF / Image)'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 4px' }}>
          💡 <strong>Tip:</strong> Uploading a document file automatically marks the status as "Submitted". You can also mark documents as submitted manually using the checkbox if a physical copy is already stored in the school files.
        </div>
      </div>
    </Drawer>
  );
}
