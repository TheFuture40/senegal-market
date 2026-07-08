import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const LOCATIONS = [
  'Sandaga', 'Pikine', 'HLM', 'Medina', 'Fass', 'Plateau',
  'Sacré-Cœur', 'Parcelles', 'Liberté', 'Mermoz', 'Ngor', 'Yoff', 'Ouakam', 'Bii'
];

export default function App() {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const inlineAudioRef = useRef(null);
  const conversationAudioRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState('');
  const [listings, setListings] = useState([]);
  const [currentTab, setCurrentTab] = useState('browse');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('All');
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageAudioBlob, setMessageAudioBlob] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isRecordingMessage, setIsRecordingMessage] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [myListingsPhoneConfirmed, setMyListingsPhoneConfirmed] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [openListingMenu, setOpenListingMenu] = useState(null);
  const [editingListingId, setEditingListingId] = useState(null);
  const [cameFromMyListings, setCameFromMyListings] = useState(false);
  const [playingListingId, setPlayingListingId] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [messageDurations, setMessageDurations] = useState({});
  const [showTypeOption, setShowTypeOption] = useState(false);

  const formatPhoneWithPrefix = (phone) => {
    if (!phone) return phone;
    let cleaned = phone.replace(/\D/g, '');

    // Senegal numbers are commonly typed with a local leading 0
    // (e.g. "0771234567"). Without stripping it, a 10-digit Senegal
    // number collides with the 10-digit US case below and gets
    // formatted as +1... instead of +221..., producing a different
    // "canonical" phone string for what is really the same number.
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return '+' + cleaned;
    } else if (cleaned.startsWith('221') && cleaned.length === 12) {
      return '+' + cleaned;
    } else if (cleaned.length === 10) {
      return '+1' + cleaned;
    } else if (cleaned.length === 9) {
      return '+221' + cleaned;
    }
    return phone;
  };

  // Parses the photo_data column into a normalized array of photo strings.
  // Handles: null/empty, a JSON-array string, or a single raw data-URL string.
  const parsePhotoData = (photoData) => {
    if (!photoData) return [];
    try {
      if (typeof photoData === 'string' && photoData.startsWith('[')) {
        return JSON.parse(photoData);
      }
      return [photoData];
    } catch (e) {
      return [];
    }
  };

  // Builds an <audio> element with both webm and mp4 <source> children so the
  // browser can pick whichever format it can actually decode, instead of us
  // guessing a single mime type up front.
  const createDualSourceAudio = (audioBase64) => {
    const audio = document.createElement('audio');
    const webmSource = document.createElement('source');
    webmSource.src = `data:audio/webm;base64,${audioBase64}`;
    webmSource.type = 'audio/webm';
    const mp4Source = document.createElement('source');
    mp4Source.src = `data:audio/mp4;base64,${audioBase64}`;
    mp4Source.type = 'audio/mp4';
    audio.appendChild(webmSource);
    audio.appendChild(mp4Source);
    return audio;
  };

  // "1:05" style formatting for a duration in seconds.
  const formatDuration = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // A stable (not random-per-render) set of bar heights for a voice note's
  // decorative waveform, derived from the message id so it doesn't jump
  // around on re-render.
  const waveformHeights = (seed, count = 7) => {
    const str = String(seed);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 1000;
    }
    const heights = [];
    for (let i = 0; i < count; i++) {
      heights.push(4 + ((hash * (i + 1)) % 13));
    }
    return heights;
  };

  const loadListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('id, category, location, phone, price, photo_data, created_at, seller_phone')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        setListings([]);
        return;
      }

      if (!data) {
        setListings([]);
        return;
      }

      const formattedListings = data.map(listing => ({
        id: listing.id,
        photos: parsePhotoData(listing.photo_data),
        category: listing.category,
        location: listing.location,
        phone: listing.phone,
        seller_phone: listing.seller_phone || listing.phone,
        price: listing.price,
        audioBase64: '',
        timestamp: 'Now'
      })).filter(l => l !== null);

      setListings(formattedListings);
    } catch (err) {
      setListings([]);
    }
  };

  const loadMessages = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      setMessages(data || []);
    } catch (err) {
      setMessages([]);
    }
  };

  const loadListingPhotos = async (listingId) => {
    setIsLoadingListing(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('id, category, location, phone, price, photo_data, audio_data, seller_phone')
        .eq('id', listingId)
        .single();

      if (error || !data) {
        setIsLoadingListing(false);
        return;
      }

      const photos = parsePhotoData(data.photo_data);

      setSelectedListing({
        id: data.id,
        category: data.category,
        location: data.location,
        phone: data.phone,
        seller_phone: data.seller_phone,
        price: data.price,
        photos: photos,
        audioBase64: data.audio_data || ''
      });
      setIsLoadingListing(false);
    } catch (err) {
      setIsLoadingListing(false);
    }
  };

  useEffect(() => {
    loadListings();
    loadMessages();
  }, []);

  // Probe the duration of any voice message we haven't measured yet (without
  // playing it), so bubbles can show a real "0:14" instead of a placeholder.
  useEffect(() => {
    messages.forEach(msg => {
      if (!msg.audio_data || messageDurations[msg.id] !== undefined) return;

      const probe = createDualSourceAudio(msg.audio_data);
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        setMessageDurations(prev => (prev[msg.id] !== undefined ? prev : { ...prev, [msg.id]: probe.duration }));
      };
      probe.onerror = () => {
        setMessageDurations(prev => (prev[msg.id] !== undefined ? prev : { ...prev, [msg.id]: 0 }));
      };
      probe.load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Njuroom sa microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startRecordingMessage = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setMessageAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingMessage(true);
    } catch (err) {
      alert('Njuroom sa microphone.');
    }
  };

  const stopRecordingMessage = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingMessage(false);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (photos.length < 3) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setPhotos(prev => [...prev, event.target.result]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerFilePicker = () => fileInputRef.current?.click();
  const removePhoto = (index) => setPhotos(photos.filter((_, i) => i !== index));

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleListIt = async () => {
    if (!audioBlob || photos.length === 0 || !selectedCategory || !selectedLocation || !phone || !price) {
      alert('Joxal baaxalal bu nekk');
      return;
    }

    try {
      alert('Saving listing...');
      const audioBase64 = await blobToBase64(audioBlob);

      const { error } = await supabase.from('listings').insert([{
        category: selectedCategory,
        location: selectedLocation,
        phone: formatPhoneWithPrefix(phone),
        price: price,
        photo_data: JSON.stringify(photos),
        audio_data: audioBase64,
        seller_phone: formatPhoneWithPrefix(phone)
      }]);

      if (error) throw error;

      setAudioBlob(null);
      setPhotos([]);
      setSelectedCategory(null);
      setSelectedLocation(null);
      setPhone('');
      setPrice('');
      setCurrentTab('browse');

      alert('Baaxal liggéey naa!');

      await new Promise(resolve => setTimeout(resolve, 1000));
      loadListings();
    } catch (err) {
      alert('Njuroom sa.');
    }
  };

  const handleUpdateListing = async () => {
    if (!selectedCategory || !selectedLocation || !phone || !price || !editingListingId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const updates = {
        category: selectedCategory,
        location: selectedLocation,
        phone: formatPhoneWithPrefix(phone),
        price: parseInt(price),
        created_at: new Date().toISOString()
      };

      if (audioBlob) {
        const audioBase64 = await blobToBase64(audioBlob);
        updates.audio_data = audioBase64;
      }

      if (photos.length > 0) {
        updates.photo_data = JSON.stringify(photos);
      }

      await supabase
        .from('listings')
        .update(updates)
        .eq('id', editingListingId);

      setEditingListingId(null);
      setAudioBlob(null);
      setPhotos([]);
      setSelectedCategory(null);
      setSelectedLocation(null);
      setPhone('');
      setPrice('');

      await loadListings();
      alert('Listing updated!');
      setCurrentTab('my-listings');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const deleteListing = async (id) => {
    const listing = listings.find(l => l.id === id);

    if (!userPhone || formatPhoneWithPrefix(listing.seller_phone || listing.phone) !== formatPhoneWithPrefix(userPhone)) {
      alert('Only the seller can delete this listing');
      return;
    }

    if (!window.confirm('Delete this listing?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setListings(listings.filter(l => l.id !== id));
      setSelectedListing(null);
      alert('Baaxal teejindi');
    } catch (err) {
      alert('Error deleting listing');
    }
  };

  const sendMessage = async () => {
    if (!messageAudioBlob && !messageText) {
      alert('Record audio or type a message');
      return;
    }

    if (!userPhone) {
      alert('Please enter your phone number');
      return;
    }

    try {
      let audioBase64 = '';
      if (messageAudioBlob) {
        audioBase64 = await blobToBase64(messageAudioBlob);
      }

      const { error } = await supabase.from('messages').insert([{
        listing_id: selectedConversation.id,
        sender_phone: userPhone,
        receiver_phone: selectedConversation.phone,
        audio_data: audioBase64 || null,
        message_text: messageText || null
      }]);

      if (error) throw error;

      await loadMessages();
      setMessageAudioBlob(null);
      setMessageText('');
      alert('Message sent!');
    } catch (err) {
      alert('Error sending message');
    }
  };

  // Plays/pauses a message's voice note inline, right from the messages list,
  // without needing to open the conversation first.
  const toggleInlineAudio = (listingId, audioBase64) => {
    if (!audioBase64) return;

    const current = inlineAudioRef.current;

    // Tapping the one that's already playing pauses it.
    if (playingListingId === listingId && current) {
      current.pause();
      setPlayingListingId(null);
      return;
    }

    // Switching tracks (or starting fresh): stop whatever was playing.
    if (current) {
      current.pause();
      current.currentTime = 0;
    }

    const audio = createDualSourceAudio(audioBase64);
    inlineAudioRef.current = audio;

    audio.onended = () => setPlayingListingId(null);
    audio.onerror = () => setPlayingListingId(null);

    audio.load();
    audio.play()
      .then(() => setPlayingListingId(listingId))
      .catch((err) => {
        console.error('Inline audio playback failed:', err);
        setPlayingListingId(null);
      });
  };

  // Same play/pause toggle as toggleInlineAudio, scoped to a message inside
  // an open conversation instead of a listing in the messages list.
  const toggleMessageAudio = (messageId, audioBase64) => {
    if (!audioBase64) return;

    const current = conversationAudioRef.current;

    if (playingMessageId === messageId && current) {
      current.pause();
      setPlayingMessageId(null);
      return;
    }

    if (current) {
      current.pause();
      current.currentTime = 0;
    }

    const audio = createDualSourceAudio(audioBase64);
    conversationAudioRef.current = audio;

    audio.onended = () => setPlayingMessageId(null);
    audio.onerror = () => setPlayingMessageId(null);

    audio.load();
    audio.play()
      .then(() => setPlayingMessageId(messageId))
      .catch((err) => {
        console.error('Message audio playback failed:', err);
        setPlayingMessageId(null);
      });
  };

  const categoryIcons = {
    'Yeet': '🐟', 'Jeep': '🍚', 'Taaxat': '🥬', 'Pampe': '🍌',
    'Jaxas': '🥔', 'Yaañu': '🥚', 'Jujuben': '🌰', 'Bii': '📦',
    'Fish': '🐟', 'Vegetables': '🥬', 'Fruits': '🍌', 'Loujum': '🍲'
  };

  const getUniqueLocations = () => {
    if (listings.length === 0) return [];
    return [...new Set(listings.map(l => l.location))].sort();
  };

  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e) => {
    setTouchEnd(e.changedTouches[0].clientX);
    if (!selectedListing) return;
    const distance = touchStart - touchEnd;
    if (distance > 50 && currentPhotoIndex < selectedListing.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
    if (distance < -50 && currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  // PHONE VERIFICATION PAGE
  if (showPhoneVerification) {
    const isValidPhone = () => {
      const phone = verificationPhone.replace(/\D/g, '');
      return (phone.startsWith('1') && phone.length === 11) || (phone.startsWith('221') && phone.length === 12);
    };

    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setShowPhoneVerification(false)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Verify Phone</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>Verify Your Phone</div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '24px', textAlign: 'center', maxWidth: '300px' }}>Enter your US or Senegal phone number to start selling</div>

            <input
              type="tel"
              value={verificationPhone}
              onChange={(e) => setVerificationPhone(e.target.value)}
              placeholder="+1 (555) 123-4567 or +221 77 123 45 67"
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid ' + (verificationPhone && !isValidPhone() ? '#ff4444' : '#444'), borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '8px' }}
            />
            {verificationPhone && !isValidPhone() && <div style={{ fontSize: '11px', color: '#ff4444', marginBottom: '16px' }}>Please enter a valid US (+1) or Senegal (+221) number</div>}

            <button
              onClick={() => {
                if (!isValidPhone()) {
                  alert('Please enter a valid US or Senegal phone number');
                  return;
                }
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setVerificationCode('');
                alert('Verification code: ' + code + '\n\n(In production, this would be sent via SMS)');
                window.testCode = code;
              }}
              disabled={!verificationPhone}
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: verificationPhone ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: verificationPhone ? 'pointer' : 'not-allowed', fontSize: '13px', marginBottom: '16px' }}>
              Send Code
            </button>

            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '16px' }}
            />

            <button
              onClick={() => {
                if (verificationCode === window.testCode) {
                  setUserPhone(formatPhoneWithPrefix(verificationPhone));
                  setPhoneVerified(true);
                  setMyListingsPhoneConfirmed(true);
                  setShowPhoneVerification(false);
                  setCurrentTab('create');
                  setVerificationPhone('');
                  setVerificationCode('');
                  alert('Phone verified!');
                } else {
                  alert('Invalid code');
                }
              }}
              disabled={!verificationCode}
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: verificationCode ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: verificationCode ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
              Verify Code
            </button>
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
            <button onClick={() => setShowPhoneVerification(false)} style={{ width: '100%', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
          </div>
        </div>
      </div>
    );
  }

  // SETTINGS PAGE
  if (currentTab === 'settings') {
    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setCurrentTab('browse')} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Settings</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
            <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', border: '1px solid #333', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>Your Phone Number</div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: '600' }}>{userPhone || 'Not verified'}</div>
            </div>

            <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', border: '1px solid #333' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'white' }}>About Sunu Market</div>
              <div style={{ fontSize: '13px', color: '#999', lineHeight: '1.6' }}>
                Sunu Market is a voice-first marketplace for Senegalese traders. List your products, add photos, and connect with buyers directly.
              </div>
            </div>
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
            <button onClick={() => setCurrentTab('browse')} style={{ width: '100%', padding: '12px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
          </div>
        </div>
      </div>
    );
  }

  // MY LISTINGS PAGE
  if (currentTab === 'my-listings') {
    const isLoggedIn = phoneVerified || myListingsPhoneConfirmed;

    if (!isLoggedIn) {
      const isValidPhone = () => {
        const phone = tempPhone.replace(/\D/g, '');
        return (phone.startsWith('1') && phone.length === 11) || (phone.startsWith('221') && phone.length === 12);
      };

      return (
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
          <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setCurrentTab('browse')} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Verify Phone</div>
              <div style={{ width: '28px' }}></div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>Verify Your Phone</div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '24px', textAlign: 'center', maxWidth: '300px' }}>Enter your US or Senegal phone number to view your listings</div>

              <input
                type="tel"
                value={tempPhone}
                onChange={(e) => setTempPhone(e.target.value)}
                placeholder="+1 (555) 123-4567 or +221 77 123 45 67"
                style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid ' + (tempPhone && !isValidPhone() ? '#ff4444' : '#444'), borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '8px' }}
              />
              {tempPhone && !isValidPhone() && <div style={{ fontSize: '11px', color: '#ff4444', marginBottom: '16px' }}>Please enter a valid US (+1) or Senegal (+221) number</div>}

              <button
                onClick={() => {
                  if (!isValidPhone()) {
                    alert('Please enter a valid US or Senegal phone number');
                    return;
                  }
                  const code = Math.floor(100000 + Math.random() * 900000).toString();
                  setVerificationCode('');
                  alert('Verification code: ' + code + '\n\n(In production, this would be sent via SMS)');
                  window.testCode = code;
                }}
                disabled={!tempPhone}
                style={{ width: '100%', maxWidth: '300px', padding: '12px', background: tempPhone ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: tempPhone ? 'pointer' : 'not-allowed', fontSize: '13px', marginBottom: '16px' }}>
                Send Code
              </button>

              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '16px' }}
              />

              <button
                onClick={() => {
                  if (verificationCode === window.testCode) {
                    setUserPhone(formatPhoneWithPrefix(tempPhone));
                    setPhoneVerified(true);
                    setMyListingsPhoneConfirmed(true);
                    setTempPhone('');
                    setVerificationCode('');
                    alert('Phone verified!');
                  } else {
                    alert('Invalid code');
                  }
                }}
                disabled={!verificationCode}
                style={{ width: '100%', maxWidth: '300px', padding: '12px', background: verificationCode ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: verificationCode ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
                Verify Code
              </button>
            </div>

            <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
              <button onClick={() => setCurrentTab('browse')} style={{ width: '100%', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
            </div>
          </div>
        </div>
      );
    }

    const myListings = listings.filter(l => formatPhoneWithPrefix(l.seller_phone || l.phone) === userPhone);

    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => { setCurrentTab('browse'); setMyListingsPhoneConfirmed(false); }} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>My Listings ({myListings.length})</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {myListings.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: '80px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                <div>You haven't created any listings yet</div>
              </div>
            ) : (
              myListings.map(listing => (
                <div key={listing.id} onClick={async () => {
                  setCameFromMyListings(true);
                  setCurrentPhotoIndex(0);
                  await loadListingPhotos(listing.id);
                  setCurrentTab('browse');
                }} style={{ background: '#242424', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #333', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                      <div style={{ fontSize: '40px' }}>{categoryIcons[listing.category] || '📦'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>{listing.category}</div>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>📍 {listing.location}</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button onClick={(e) => { e.stopPropagation(); setOpenListingMenu(openListingMenu === listing.id ? null : listing.id); }} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>⋮</button>
                      {openListingMenu === listing.id && (
                        <div style={{ position: 'absolute', top: '30px', right: '0', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', zIndex: 50, minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setCurrentPhotoIndex(0);
                            try {
                              supabase
                                .from('listings')
                                .select('id, category, location, phone, price, photo_data, audio_data')
                                .eq('id', listing.id)
                                .single()
                                .then(({ data }) => {
                                  if (data) {
                                    const photos = parsePhotoData(data.photo_data);

                                    setPhotos(photos);
                                    setAudioBlob(null);
                                    setSelectedCategory(data.category);
                                    setSelectedLocation(data.location);
                                    setPhone(data.phone);
                                    setPrice(data.price.toString());
                                    setEditingListingId(listing.id);
                                    setCameFromMyListings(true);
                                    setCurrentTab('create');
                                  }
                                });
                            } catch (err) {
                              console.error('Error:', err);
                            }
                            setOpenListingMenu(null);
                          }} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333', fontWeight: '500' }}>✏️ Edit</button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this listing?')) {
                              deleteListing(listing.id);
                            }
                            setOpenListingMenu(null);
                          }} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: '#ff4444', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: '500' }}>🗑️ Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
            <button onClick={() => { setCurrentTab('browse'); setMyListingsPhoneConfirmed(false); }} style={{ width: '100%', padding: '12px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
          </div>
        </div>
      </div>
    );
  }

  // MESSAGES PAGE
if (currentTab === 'messages') {
  const isMessagesLoggedIn = phoneVerified || myListingsPhoneConfirmed;

  if (!isMessagesLoggedIn) {
    const isValidPhone = () => {
      const phone = tempPhone.replace(/\D/g, '');
      return (phone.startsWith('1') && phone.length === 11) || (phone.startsWith('221') && phone.length === 12);
    };

    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setCurrentTab('browse')} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Verify Phone</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>Verify Your Phone</div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '24px', textAlign: 'center', maxWidth: '300px' }}>Enter your US or Senegal phone number to view your messages</div>

            <input
              type="tel"
              value={tempPhone}
              onChange={(e) => setTempPhone(e.target.value)}
              placeholder="+1 (555) 123-4567 or +221 77 123 45 67"
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid ' + (tempPhone && !isValidPhone() ? '#ff4444' : '#444'), borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '8px' }}
            />
            {tempPhone && !isValidPhone() && <div style={{ fontSize: '11px', color: '#ff4444', marginBottom: '16px' }}>Please enter a valid US (+1) or Senegal (+221) number</div>}

            <button
              onClick={() => {
                if (!isValidPhone()) {
                  alert('Please enter a valid US or Senegal phone number');
                  return;
                }
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setVerificationCode('');
                alert('Verification code: ' + code + '\n\n(In production, this would be sent via SMS)');
                window.testCode = code;
              }}
              disabled={!tempPhone}
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: tempPhone ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: tempPhone ? 'pointer' : 'not-allowed', fontSize: '13px', marginBottom: '16px' }}>
              Send Code
            </button>

            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: '#242424', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white', marginBottom: '16px' }}
            />

            <button
              onClick={() => {
                if (verificationCode === window.testCode) {
                  setUserPhone(formatPhoneWithPrefix(tempPhone));
                  setPhoneVerified(true);
                  setMyListingsPhoneConfirmed(true);
                  setTempPhone('');
                  setVerificationCode('');
                  alert('Phone verified!');
                } else {
                  alert('Invalid code');
                }
              }}
              disabled={!verificationCode}
              style={{ width: '100%', maxWidth: '300px', padding: '12px', background: verificationCode ? '#0f6e56' : '#444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: verificationCode ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
              Verify Code
            </button>
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
            <button onClick={() => setCurrentTab('browse')} style={{ width: '100%', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setSelectedConversation(null)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedConversation.category}</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.filter(m =>
              m.listing_id === selectedConversation.id && (
                (formatPhoneWithPrefix(m.sender_phone) === formatPhoneWithPrefix(userPhone) && formatPhoneWithPrefix(m.receiver_phone) === formatPhoneWithPrefix(selectedConversation.phone)) ||
                (formatPhoneWithPrefix(m.sender_phone) === formatPhoneWithPrefix(selectedConversation.phone) && formatPhoneWithPrefix(m.receiver_phone) === formatPhoneWithPrefix(userPhone))
              )
            ).map(msg => {
              const isOwn = formatPhoneWithPrefix(msg.sender_phone) === formatPhoneWithPrefix(userPhone);
              const bars = waveformHeights(msg.id);
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    maxWidth: '82%',
                    background: isOwn ? '#0b4a3c' : '#242424',
                    border: isOwn ? 'none' : '1px solid #333',
                    borderRadius: '14px',
                    padding: '10px 12px'
                  }}>
                    {msg.audio_data ? (
                      <>
                        <button
                          onClick={() => toggleMessageAudio(msg.id, msg.audio_data)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: isOwn ? '#9fe1cb' : '#0f6e56',
                            border: 'none', color: isOwn ? '#085041' : 'white',
                            fontSize: '12px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          {playingMessageId === msg.id ? '⏸' : '▶'}
                        </button>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px', flex: 1, minWidth: '50px' }}>
                          {bars.map((h, i) => (
                            <div key={i} style={{ width: '2px', height: `${h}px`, background: isOwn ? '#9fe1cb' : '#1D9E75', borderRadius: '1px' }}></div>
                          ))}
                        </div>
                        <span style={{ fontSize: '10px', color: isOwn ? '#c8e9dc' : '#999', flexShrink: 0 }}>
                          {formatDuration(messageDurations[msg.id])}
                        </span>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'white' }}>{msg.message_text}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>{new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>Chatting as {userPhone}</div>

            <button
              onClick={isRecordingMessage ? stopRecordingMessage : startRecordingMessage}
              style={{
                width: '64px', height: '64px', borderRadius: '50%', border: 'none', color: 'white',
                background: isRecordingMessage ? '#ff4444' : '#0f6e56',
                fontSize: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              {isRecordingMessage ? '⏹' : '🎤'}
            </button>
            <div style={{ fontSize: '11px', color: '#999' }}>{isRecordingMessage ? 'Recording... tap to stop' : 'Tap to record a voice reply'}</div>

            {messageAudioBlob && (
              <div style={{ width: '100%', background: '#1a1a1a', borderRadius: '10px', padding: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <audio controls style={{ width: '100%', height: '32px' }} src={URL.createObjectURL(messageAudioBlob)} preload="auto" />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setMessageAudioBlob(null)} style={{ flex: 1, padding: '8px', background: '#333', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', cursor: 'pointer' }}>Discard</button>
                  <button onClick={sendMessage} style={{ flex: 1, padding: '8px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Send voice</button>
                </div>
              </div>
            )}

            <button onClick={() => setShowTypeOption(!showTypeOption)} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '11px', cursor: 'pointer', marginTop: '4px' }}>
              ⌨️ {showTypeOption ? 'Hide typing' : 'Type instead'}
            </button>

            {showTypeOption && (
              <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '10px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box', color: 'white' }} />
                <button onClick={sendMessage} style={{ padding: '10px 14px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}>Send</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Messages List - Concept D
  return (
    <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '16px', flexShrink: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>Messages</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {listings.map(listing => {
            const hasMessages = messages.some(m => m.listing_id === listing.id && (formatPhoneWithPrefix(m.sender_phone) === formatPhoneWithPrefix(userPhone) || formatPhoneWithPrefix(m.receiver_phone) === formatPhoneWithPrefix(userPhone)));
            if (!hasMessages) return null;

            const listingMessages = messages.filter(m => m.listing_id === listing.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const latestMessage = listingMessages[0];
            const isAudio = latestMessage?.audio_data;

            return (
              <div
                key={listing.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '0.5px solid #333',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}
                  onClick={() => setSelectedConversation(listing)}
                >
                  <div style={{ fontSize: '28px', flexShrink: 0 }}>{categoryIcons[listing.category] || '📦'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'white' }}>{listing.category}</div>
                    <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px' }}>{listing.price} F • {listing.location}</div>
                    <div style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isAudio
                        ? '🎤 Voice message'
                        : latestMessage?.message_text
                          ? (formatPhoneWithPrefix(latestMessage.sender_phone) === formatPhoneWithPrefix(userPhone) ? 'You: ' : 'Seller: ') + latestMessage.message_text
                          : ''}
                    </div>
                  </div>
                </div>

                {isAudio && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInlineAudio(listing.id, latestMessage.audio_data);
                    }}
                    style={{
                      background: '#0f6e56',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      flexShrink: 0,
                      marginLeft: '8px'
                    }}
                  >
                    {playingListingId === listing.id ? '⏸' : '▶'}
                  </button>
                )}
              </div>
            );
          })}

          {listings.filter(l => messages.some(m => m.listing_id === l.id && (formatPhoneWithPrefix(m.sender_phone) === formatPhoneWithPrefix(userPhone) || formatPhoneWithPrefix(m.receiver_phone) === formatPhoneWithPrefix(userPhone)))).length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: '80px', color: '#666' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
              <div>No messages yet</div>
            </div>
          )}
        </div>

        <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
          <button onClick={() => setCurrentTab('browse')} style={{ width: '100%', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Back to Browse</button>
        </div>
      </div>
    </div>
  );
}

  // DETAIL PAGE
  if (selectedListing) {
    const listing = selectedListing;
    const currentPhoto = listing.photos && listing.photos.length > currentPhotoIndex ? listing.photos[currentPhotoIndex] : null;

    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => {
              setSelectedListing(null);
              setCurrentPhotoIndex(0);
              if (cameFromMyListings) {
                setCurrentTab('my-listings');
                setCameFromMyListings(false);
              }
            }} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>❤️</button>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #085041 100%)', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', flexShrink: 0, backgroundImage: currentPhoto ? `url(${currentPhoto})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', opacity: isLoadingListing ? 0.5 : 1 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {isLoadingListing && <div style={{ fontSize: '40px' }}>⏳</div>}
            {!currentPhoto && !isLoadingListing && (categoryIcons[listing.category] || '📦')}
            {listing.photos && listing.photos.length > 1 && (
              <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                {listing.photos.map((_, idx) => (
                  <div key={idx} style={{ width: '8px', height: '8px', borderRadius: '50%', background: idx === currentPhotoIndex ? '#0f6e56' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }} onClick={() => setCurrentPhotoIndex(idx)}></div>
                ))}
              </div>
            )}
            {currentPhotoIndex > 0 && <button onClick={() => setCurrentPhotoIndex(currentPhotoIndex - 1)} style={{ position: 'absolute', left: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '24px', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
            {listing.photos && currentPhotoIndex < listing.photos.length - 1 && <button onClick={() => setCurrentPhotoIndex(currentPhotoIndex + 1)} style={{ position: 'absolute', right: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '24px', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
          </div>

          <div style={{ padding: '20px 16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>{listing.category}</div>
              <div style={{ fontSize: '28px', fontWeight: '600', color: '#0f6e56', marginBottom: '12px' }}>{listing.price} F</div>
              <div style={{ fontSize: '13px', color: '#999' }}>📍 {listing.location}</div>
            </div>

            <div style={{ height: '1px', background: '#333', marginBottom: '20px' }}></div>

            {listing.audioBase64 && (
              <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #333' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seller's note</div>
                <audio controls style={{ width: '100%', height: '44px' }} preload="auto">
                  <source src={`data:audio/webm;base64,${listing.audioBase64}`} type="audio/webm" />
                  <source src={`data:audio/mp4;base64,${listing.audioBase64}`} type="audio/mp4" />
                </audio>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #333' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>📍</div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{listing.location}</div>
              </div>
              <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #333' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>🕐</div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Listed</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>Now</div>
              </div>
            </div>

            {formatPhoneWithPrefix(listing.seller_phone || listing.phone) === formatPhoneWithPrefix(userPhone) && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => { if (window.confirm('Delete this listing?')) { deleteListing(listing.id); } }} style={{ width: '50px', height: '50px', background: '#ff4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
              </div>
            )}
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '12px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <a href={`tel:${listing.phone}`} style={{ flex: 1, padding: '14px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☎ Call</a>
            <button onClick={() => { setSelectedConversation(listing); setCurrentTab('messages'); }} style={{ flex: 1, padding: '14px', background: '#25d366', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬 Message</button>
          </div>
        </div>
      </div>
    );
  }

  // CREATE PAGE
  if (currentTab === 'create') {
    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
        <div style={{ background: '#242424', width: '100%', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => { setCurrentTab(cameFromMyListings ? 'my-listings' : 'browse'); setEditingListingId(null); setCameFromMyListings(false); }} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{editingListingId ? 'Edit Listing' : 'List Item'}</div>
            <div style={{ width: '28px' }}></div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Your voice</div>
              <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid #333' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
                <button onClick={isRecording ? stopRecording : startRecording} style={{ width: '100%', padding: '16px', background: '#0f6e56', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px', marginBottom: '12px' }}>{isRecording ? '⏹ Stop Recording' : '🎤 Record'}</button>
                {!audioBlob ? (
                  <div style={{ fontSize: '11px', color: '#999' }}>Not recorded</div>
                ) : (
                  <div style={{ background: '#242424', borderRadius: '8px', padding: '12px', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#0f6e56', marginBottom: '10px', fontWeight: '600' }}>✓ Recording saved</div>
                    <audio controls style={{ width: '100%', height: '40px', marginBottom: '12px' }} src={URL.createObjectURL(audioBlob)} preload="auto" />
                    <button onClick={() => setAudioBlob(null)} style={{ width: '100%', padding: '10px', background: '#ff4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}>🗑️ Delete Recording</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Photos ({photos.length}/3)</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button onClick={triggerCamera} style={{ flex: 1, padding: '16px', background: '#333', border: '1px solid #444', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>📷 Take</button>
                <button onClick={triggerFilePicker} disabled={photos.length >= 3} style={{ flex: 1, padding: '16px', background: photos.length >= 3 ? '#444' : '#1a1a1a', border: '1px solid #444', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: photos.length >= 3 ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: photos.length >= 3 ? 0.5 : 1 }}>🖼 Choose</button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
              {photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {photos.map((photo, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={photo} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333' }} />
                      <button onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ff4444', border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Category</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                {Object.entries(categoryIcons).slice(0, 8).map(([cat, icon]) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '12px', background: selectedCategory === cat ? '#0f6e56' : '#1a1a1a', border: selectedCategory === cat ? '2px solid #0f6e56' : '1px solid #444', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '20px', fontWeight: '600' }}>{icon}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>4. Location</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {LOCATIONS.slice(0, 8).map(loc => (
                  <button key={loc} onClick={() => setSelectedLocation(loc)} style={{ padding: '10px', background: selectedLocation === loc ? '#0f6e56' : '#1a1a1a', border: selectedLocation === loc ? '2px solid #0f6e56' : '1px solid #444', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>📍 {loc}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>5. Your phone</div>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77 123 45 67" style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white' }} />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>6. Price</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2000" style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', color: 'white' }} />
                <div style={{ padding: '12px', background: '#333', borderRadius: '8px', color: '#999', fontWeight: '600' }}>F</div>
              </div>
            </div>
          </div>

          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => { setCurrentTab(cameFromMyListings ? 'my-listings' : 'browse'); setEditingListingId(null); setCameFromMyListings(false); }} style={{ flex: 1, padding: '14px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button onClick={editingListingId ? handleUpdateListing : handleListIt} style={{ flex: 1, padding: '14px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>{editingListingId ? 'Update' : 'List It'}</button>
          </div>
        </div>
      </div>
    );
  }

  // HOME/BROWSE PAGE
  const uniqueLocations = getUniqueLocations();

  return (
    <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', padding: '0', margin: '0' }}>
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', color: 'white', position: 'relative' }}>

        {/* Header with Menu */}
        <div style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #085041 100%)', color: 'white', padding: '16px', borderBottom: '1px solid #333', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Sunu Market</div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px', scrollBehavior: 'smooth' }}>
              <button onClick={() => setSelectedLocationFilter('All')} style={{ padding: '6px 12px', background: selectedLocationFilter === 'All' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap', border: '1px solid ' + (selectedLocationFilter === 'All' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'), fontWeight: '600', cursor: 'pointer', color: 'white', flexShrink: 0 }}>All</button>
              {uniqueLocations.map(loc => (
                <button key={loc} onClick={() => setSelectedLocationFilter(loc)} style={{ padding: '6px 12px', background: selectedLocationFilter === loc ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap', border: '1px solid ' + (selectedLocationFilter === loc ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'), fontWeight: '600', cursor: 'pointer', color: 'white', flexShrink: 0 }}>📍 {loc}</button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'white', border: 'none', borderRadius: '8px', width: '40px', height: '40px', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px', marginLeft: '12px' }}>☰</button>
        </div>

        {/* Menu Panel */}
        {showMenu && (
          <div style={{ position: 'absolute', top: '90px', right: '16px', background: '#242424', border: '1px solid #333', borderRadius: '12px', zIndex: 100, minWidth: '200px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <button onClick={() => { setCurrentTab('my-listings'); setShowMenu(false); }} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333', fontWeight: '500' }}>📋 My Listings</button>
            <button onClick={() => { setCurrentTab('messages'); setShowMenu(false); }} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #333', fontWeight: '500' }}>💬 Messages</button>
            <button onClick={() => { setCurrentTab('settings'); setShowMenu(false); }} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: '500' }}>⚙️ Settings</button>
          </div>
        )}

        {/* Listings Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {listings.length > 0 ? (
            (() => {
              const filteredListings = selectedLocationFilter === 'All'
                ? listings
                : listings.filter(l => l.location === selectedLocationFilter);

              const categoryMap = {
                'Fish': 'Yeet',
                'Vegetables': 'Taaxat',
                'Fruits': 'Pampe',
                'Rice': 'Jeep',
                'Loujum': 'Loujum'
              };

              const normalizedListings = filteredListings.map(l => ({
                ...l,
                displayCategory: categoryMap[l.category] || l.category
              }));

              const categories = [...new Set(normalizedListings.map(l => l.displayCategory))];
              const titles = { 'Yeet': '🐟 Fish', 'Taaxat': '🥬 Vegetables', 'Pampe': '🍌 Fruits', 'Jeep': '🍚 Rice', 'Loujum': '🍲 Loujum' };
              const colors = { 'Yeet': '#0f6e56', 'Taaxat': '#1D9E75', 'Pampe': '#D4A574', 'Jeep': '#B8860B', 'Loujum': '#B8860B' };

              return categories.map(cat => {
                const items = normalizedListings.filter(l => l.displayCategory === cat);
                return (
                  <div key={cat} style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid ' + (colors[cat] || '#0f6e56'), color: 'white' }}>{titles[cat] || `${categoryIcons[cat] || '📦'} ${cat}`}</div>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '8px', scrollBehavior: 'smooth' }}>
                      {items.map(listing => (
                        <div key={listing.id} onClick={async () => {
                          setCameFromMyListings(false);
                          setCurrentPhotoIndex(0);
                          await loadListingPhotos(listing.id);
                          setCurrentTab('browse');
                        }} style={{ minWidth: '90px', background: '#242424', border: '1px solid #333', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <div style={{ height: '60px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px', backgroundImage: listing.photos && listing.photos.length > 0 && listing.photos[0] ? `url(${listing.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '6px', backgroundColor: '#333' }}>{!listing.photos || listing.photos.length === 0 || !listing.photos[0] ? (categoryIcons[listing.category] || '📦') : ''}</div>
                          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{listing.category}</div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            <div style={{ textAlign: 'center', paddingTop: '80px', color: '#666' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <div>No listings yet</div>
            </div>
          )}
        </div>

        {/* Record Button - Full Width */}
        <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '8px 16px', flexShrink: 0 }}>
          <button onClick={() => {
            if (!phoneVerified) {
              setShowPhoneVerification(true);
            } else {
              setCurrentTab('create');
            }
          }} style={{ width: '100%', padding: '12px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>🎤 Record</button>
        </div>
      </div>
    </div>
  );
}
