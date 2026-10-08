import { useEffect, useRef, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/photo-punch.css';

const gps = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('This browser does not support location.'));
  navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude,
    accuracy: position.coords.accuracy, timestamp: position.timestamp }), error => reject(new Error(error.code === 1 ? 'Allow location access to continue.' : 'Could not get an accurate location. Move outdoors and retry.')),
  { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
});
const formatTime = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });
export default function PhotoPunch() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null), [session, setSession] = useState(null), [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null), [camera, setCamera] = useState(false);
  const [assignment, setAssignment] = useState({ mode: 'scheduled', oifNumber: '', classHandlingHours: '', mockPrepHours: '' });
  const [scheduled, setScheduled] = useState(null), [scheduleError, setScheduleError] = useState('');
  const video = useRef(null), stream = useRef(null), active = useRef(true), pending = useRef(null);
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    api.get('/photo-punch/config', { signal: controller.signal }).then(({ data }) => setConfig(data)).catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.message || 'Could not load punch-in setup.'); });
    api.get('/photo-punch/scheduled-oif', { signal: controller.signal }).then(({ data }) => setScheduled(data)).catch(() => { if (!controller.signal.aborted) setScheduleError('Could not load your scheduled OIF. Retry by refreshing this screen.'); });
    const onHidden = () => { if (document.hidden) { stop(); setCamera(false); } };
    document.addEventListener('visibilitychange', onHidden);
    return () => { active.current = false; controller.abort(); pending.current?.abort(); stop(); document.removeEventListener('visibilitychange', onHidden); };
  }, []);
  useEffect(() => { if (photo) return () => URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => { if (camera && video.current) { video.current.srcObject = stream.current; video.current.play().catch(() => setError('Camera could not start. Retry camera access.')); } }, [camera]);
  const start = async () => {
    setBusy(true); setError(''); setPhoto(null); setResult(null); setSession(null); stop(); setCamera(false);
    const controller = new AbortController(); pending.current = controller;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS or localhost and a supported browser.');
      const location = await gps();
      if (!active.current) return;
      const { data } = await api.post('/photo-punch/capture-session', { location }, { signal: controller.signal });
      if (!active.current) return;
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!active.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setSession(data); setCamera(true);
    } catch (e) { if (active.current) setError(e.response?.data?.message || (e.name === 'NotAllowedError' ? 'Allow camera access to take your punch-in photo.' : e.message)); }
    finally { if (active.current) setBusy(false); }
  };
  const capture = async () => {
    if (!video.current?.videoWidth || !session) return;
    setBusy(true); setError('');
    try {
      // Recheck location immediately before exposure. Server signs fresh coordinates and time.
      const location = await gps();
      const controller = new AbortController(); pending.current = controller;
      const { data } = await api.post('/photo-punch/capture-session', { location }, { signal: controller.signal });
      if (!active.current || !video.current || !stream.current) return;
      setSession(data);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / video.current.videoWidth);
      canvas.width = Math.round(video.current.videoWidth * scale); canvas.height = Math.round(video.current.videoHeight * scale);
      const ctx = canvas.getContext('2d'); ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0, squares = 0, count = 0;
      for (let i = 0; i < sample.length; i += 160) { const v = (sample[i] + sample[i + 1] + sample[i + 2]) / 3; total += v; squares += v * v; count++; }
      if (count && (total / count < 12 || squares / count - (total / count) ** 2 < 12)) throw new Error('Photo is too dark or blank. Improve lighting and retake.');
      const font = Math.max(13, Math.round(canvas.width * .022));
      const height = font * 7; ctx.fillStyle = 'rgba(8,20,32,.82)'; ctx.fillRect(0, canvas.height - height, canvas.width, height);
      ctx.fillStyle = '#fff'; ctx.font = `600 ${font * 1.25}px sans-serif`;
      ctx.fillText('TOMS | Campus punch-in', font, canvas.height - height + font * 1.7);
      ctx.font = `${font}px sans-serif`;
      const lines = [`${user.name}`, `Lat ${location.latitude.toFixed(6)}  Long ${location.longitude.toFixed(6)}`,
        `${data.distance} m from campus centre | GPS accuracy +/- ${Math.round(location.accuracy)} m`, `${formatTime(data.capturedAt)} IST${data.mode === 'preview' ? ' | PROTOTYPE' : ''}`];
      lines.forEach((line, index) => ctx.fillText(line, font, canvas.height - height + font * (3.1 + index * 1.05)));
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .85));
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Photo could not be prepared. Retake it.');
      if (active.current) { setPhoto({ blob, url: URL.createObjectURL(blob) }); stop(); setCamera(false); }
    } catch (e) { if (active.current) setError(e.response?.data?.message || e.message); }
    finally { if (active.current) setBusy(false); }
  };
  const submit = async (driveTest = false) => {
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('photo', photo.blob, 'punch.jpg'); body.append('token', session.token);
      body.append('assignment', JSON.stringify(assignment));
      const controller = new AbortController(); pending.current = controller;
      const { data } = await api.post(driveTest === true ? '/photo-punch/test-upload' : '/photo-punch/submit', body, { signal: controller.signal, timeout: 90000, headers: { 'Content-Type': 'multipart/form-data' } });
      if (active.current) setResult(data);
    } catch (e) { if (active.current) setError(e.response?.data?.message || 'Punch-in failed. Attendance was not confirmed.'); }
    finally { if (active.current) setBusy(false); }
  };
  return <div className="photo-punch">
    <header className="photo-punch__heading"><div><span className="photo-punch__eyebrow">TOMS ATTENDANCE</span><h1>Campus punch-in</h1><p>A fresh photo. Your location. One simple check-in.</p></div><span className="photo-punch__badge">{config?.mode === 'live' ? 'Live' : 'Prototype'}</span></header>
    <div className="photo-punch__grid"><section className="photo-punch__card">
      <div className="photo-punch__card-title"><h2>{photo ? 'Review your photo' : 'Take your punch-in photo'}</h2><span>1.5 km campus radius</span></div>
      <div className="photo-punch__camera">{photo ? <img src={photo.url} alt="Captured punch-in photo with location and IST timestamp" /> : camera ? <video ref={video} autoPlay muted playsInline aria-label="Live punch-in camera" /> : <div className="photo-punch__placeholder"><span aria-hidden="true">◎</span><h3>Ready when you are</h3><p>Allow camera and precise location access. Photos are captured here, not selected from your gallery.</p></div>}</div>
      {error && <p className="photo-punch__error" role="alert">{error}</p>}
      {!result && <div className="photo-punch__assignment">
        <label htmlFor="punch-oif-mode">OIF type</label>
        <select id="punch-oif-mode" className="form-select" value={assignment.mode} disabled={busy} onChange={e => setAssignment(previous => ({ ...previous, mode: e.target.value }))}>
          <option value="scheduled">Scheduled OIF</option><option value="other">Other OIF</option><option value="it">IT</option><option value="capsule">MBU capsule</option>
        </select>
        {assignment.mode === 'scheduled' && <p>{scheduleError || (scheduled ? `${scheduled.oifNumber || 'No scheduled OIF found'} · ${scheduled.classHandlingHours} class hours. Fetched automatically from your timetable.` : 'Loading timetable…')}</p>}
        {assignment.mode === 'other' && <div className="photo-punch__manual-fields">
          <label>OIF number<input className="form-control" maxLength={12} value={assignment.oifNumber} disabled={busy} onChange={e => setAssignment(p => ({ ...p, oifNumber: e.target.value }))} /></label>
          <label>Class hours<input className="form-control" type="number" min="0" max="24" step="0.5" value={assignment.classHandlingHours} disabled={busy} onChange={e => setAssignment(p => ({ ...p, classHandlingHours: e.target.value }))} /></label>
          <label>Mock or IT hours<input className="form-control" type="number" min="0" max="24" step="0.5" value={assignment.mockPrepHours} disabled={busy} onChange={e => setAssignment(p => ({ ...p, mockPrepHours: e.target.value }))} /></label>
          <small>Enter 0 for hours that do not apply.</small>
        </div>}
        {['it', 'capsule'].includes(assignment.mode) && <p>OIF: {assignment.mode === 'it' ? 'IT' : 'CA26421'} · 7 IT hours, using the current attendance rules.</p>}
      </div>}
      {result?.assignment && <p>OIF: {result.assignment.oifNumber || 'No scheduled OIF'} · Class hours: {result.assignment.classHandlingHours} · Mock / IT hours: {result.assignment.mockPrepHours}</p>}
      {result && <div className="photo-punch__success" role="status"><strong>{result.uploaded ? 'Photo uploaded to Drive' : result.preview ? 'Preview complete' : 'You are checked in'}</strong><p>{result.message}</p><small>{result.folder}</small>{result.photoUrl && <a href={result.photoUrl} target="_blank" rel="noreferrer">View photo in Drive</a>}</div>}
      <div className="photo-punch__actions">{!camera && !photo && <button className="btn btn-primary" disabled={busy || !config} onClick={start}>{busy ? 'Checking location…' : 'Enable camera & location'}</button>}
        {camera && <><button className="btn btn-primary" disabled={busy} onClick={capture}>{busy ? 'Checking…' : 'Take photo'}</button><button className="btn btn-outline-secondary" disabled={busy} onClick={() => { stop(); setCamera(false); }}>Cancel</button></>}
        {photo && !result && <><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Verifying…' : config?.mode === 'live' ? 'Punch in' : 'Test punch-in'}</button><button className="btn btn-outline-secondary" disabled={busy} onClick={start}>Retake</button><a className="btn btn-outline-secondary" href={photo.url} download="toms-punch-preview.jpg">Download preview</a></>}
        {result && <button className="btn btn-outline-secondary" onClick={start}>Start again</button>}
      </div>
      {photo && !result && config?.driveTestAvailable && <button className="btn btn-primary" disabled={busy} onClick={() => submit(true)}>{busy ? 'Uploading…' : 'Upload to Drive (test)'}</button>}
      {photo && !result && <p className="photo-punch__fine">Submit within 60 seconds of capture, or retake your photo for a fresh location check.</p>}
    </section><aside className="photo-punch__card photo-punch__details"><h2>Your check-in checks</h2>
      <dl><dt>Location</dt><dd>{session ? `${session.distance} m from centre; +/- ${Math.round(session.location.accuracy)} m accuracy` : 'Fresh GPS reading required'}</dd><dt>Network</dt><dd>{session?.network === 'clear' ? 'No VPN/proxy flag reported' : 'Not verified yet'}</dd><dt>Photo storage</dt><dd>University Google Drive<br /><small>toms punch ins / date / photo.jpg</small></dd><dt>Attendance</dt><dd>{config?.mode === 'live' ? 'Recorded after Drive upload succeeds' : 'Preview only; real attendance is unchanged'}</dd></dl>
    </aside></div>
  </div>;
}
