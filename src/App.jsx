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

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedListings = data.map(listing => ({
        id: listing.id,
        photos: typeof listing.photo_data === 'string' 
          ? JSON.parse(listing.photo_data) 
          : [listing.photo_data],
        category: listing.category,
        location: listing.location,
        phone: listing.phone,
        price: listing.price,
        audioUrl: `data:audio/wav;base64,${listing.audio_data}`,
        timestamp: new Date(listing.created_at).toLocaleString()
      }));

      setListings(formattedListings);
    } catch (err) {
      console.error('Error loading listings:', err);
    }
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      setAudioBlob(blob);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newPhotos = [...photos];
      files.forEach(file => {
        if (newPhotos.length < 3) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPhotos(prev => [...prev, event.target.result]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
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
      const audioBase64 = await blobToBase64(audioBlob);
      
      const { error } = await supabase
        .from('listings')
        .insert([
          {
            category: selectedCategory,
            location: selectedLocation,
            phone: phone,
            price: price,
            photo_data: JSON.stringify(photos),
            audio_data: audioBase64
          }
        ]);

      if (error) throw error;

      await loadListings();

      setAudioBlob(null);
      setPhotos([]);
      setSelectedCategory(null);
      setSelectedLocation(null);
      setPhone('');
      setPrice('');
      setCurrentTab('browse');
      
      alert('Baaxal liggéey naa!');
    } catch (err) {
      console.error('Error creating listing:', err);
      alert('Njuroom sa. Jongale biir.');
    }
  };

  const categoryIcons = {
    'Yeet': '🐟',
    'Jeep': '🍚',
    'Taaxat': '🥬',
    'Pampe': '🍌',
    'Jaxas': '🥔',
    'Yaañu': '🥚',
    'Jujuben': '🌰',
    'Bii': '📦'
  };

  const getUniqueLocations = () => {
    const locs = [...new Set(listings.map(l => l.location))];
    return locs.sort();
  };

  const listingsByCategory = (cat) => {
    if (selectedLocationFilter === 'All') {
      return listings.filter(l => l.category === cat);
    }
    return listings.filter(l => l.category === cat && l.location === selectedLocationFilter);
  };

  // Swipe handlers for photos
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    if (!selectedListing) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPhotoIndex < selectedListing.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
    if (isRightSwipe && currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  // DETAIL PAGE VIEW
  if (selectedListing) {
    const listing = selectedListing;
    const currentPhoto = listing.photos[currentPhotoIndex];
    
    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', margin: '0' }}>
        <div style={{ background: '#1a1a1a', borderRadius: '0', overflow: 'hidden', width: '100%', height: '100vh', boxShadow: 'none', color: 'white', display: 'flex', flexDirection: 'column' }}>
          {/* Header bar */}
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, zIndex: 10 }}>
            <button 
              onClick={() => {
                setSelectedListing(null);
                setCurrentPhotoIndex(0);
              }}
              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <button style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>❤️</button>
          </div>

          {/* Photo carousel */}
          <div 
            style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #085041 100%)', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', flexShrink: 0, backgroundImage: currentPhoto ? `url(${currentPhoto})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', touchAction: 'pan-y' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {!currentPhoto && (Object.entries(categoryIcons).find(([k]) => k === listing.category)?.[1] || '📦')}

            {/* Photo indicators */}
            {listing.photos.length > 1 && (
              <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                {listing.photos.map((_, idx) => (
                  <div
                    key={idx}
                    style={{ width: '8px', height: '8px', borderRadius: '50%', background: idx === currentPhotoIndex ? '#0f6e56' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    onClick={() => setCurrentPhotoIndex(idx)}
                  ></div>
                ))}
              </div>
            )}

            {/* Swipe arrows */}
            {currentPhotoIndex > 0 && (
              <button 
                onClick={() => setCurrentPhotoIndex(currentPhotoIndex - 1)}
                style={{ position: 'absolute', left: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '24px', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            )}
            {currentPhotoIndex < listing.photos.length - 1 && (
              <button 
                onClick={() => setCurrentPhotoIndex(currentPhotoIndex + 1)}
                style={{ position: 'absolute', right: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '24px', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>{listing.category}</div>
              <div style={{ fontSize: '28px', fontWeight: '600', color: '#0f6e56', marginBottom: '12px' }}>{listing.price} F</div>
              <div style={{ fontSize: '13px', color: '#999' }}>📍 {listing.location} • {listing.timestamp}</div>
            </div>

            <div style={{ height: '1px', background: '#333', marginBottom: '20px' }}></div>

            {/* Audio player */}
            {listing.audioUrl && (
              <div style={{ background: '#242424', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #333' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seller's note</div>
                <audio controls style={{ width: '100%', height: '32px' }} src={listing.audioUrl} />
              </div>
            )}

            {/* Info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
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
          </div>

          {/* Action buttons */}
          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '12px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <a href={`tel:${listing.phone}`} style={{ flex: 1, padding: '14px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☎ Call</a>
            <a href={`https://wa.me/221${listing.phone.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '14px', background: '#25d366', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬 WhatsApp</a>
          </div>
        </div>
      </div>
    );
  }

  // CREATE PAGE VIEW
  if (currentTab === 'create') {
    return (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', margin: '0' }}>
        <div style={{ background: '#242424', borderRadius: '0', overflow: 'hidden', width: '100%', height: '100vh', boxShadow: 'none', color: 'white', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ background: '#242424', borderBottom: '1px solid #333', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button 
              onClick={() => setCurrentTab('browse')}
              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #444', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'white' }}>←</button>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>List Item</div>
            <div style={{ width: '28px' }}></div>
          </div>

          {/* Scrollable form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
            
            {/* Voice Recording */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Your voice</div>
              <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid #333' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{ width: '100%', padding: '16px', background: '#0f6e56', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px', marginBottom: '8px' }}>
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                <div style={{ fontSize: '11px', color: '#999' }}>{audioBlob ? '✓ Recorded' : 'Not recorded'}</div>
              </div>
            </div>

            {/* Photos (1-3) */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Photos ({photos.length}/3)</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button 
                  onClick={triggerCamera}
                  style={{ flex: 1, padding: '16px', background: '#333', border: '1px solid #444', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>📷 Take</button>
                <button 
                  onClick={triggerFilePicker}
                  disabled={photos.length >= 3}
                  style={{ flex: 1, padding: '16px', background: photos.length >= 3 ? '#444' : '#1a1a1a', border: '1px solid #444', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: photos.length >= 3 ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: photos.length >= 3 ? 0.5 : 1 }}>🖼 Choose</button>
              </div>
              <input 
                ref={cameraInputRef}
                type="file" 
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />

              {/* Photo grid */}
              {photos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {photos.map((photo, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={photo} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333' }} />
                      <button 
                        onClick={() => removePhoto(idx)}
                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ff4444', border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length === 0 && <div style={{ fontSize: '11px', color: '#999' }}>No photos selected</div>}
            </div>

            {/* Category */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Category</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                {Object.entries(categoryIcons).map(([cat, icon]) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{ padding: '12px', background: selectedCategory === cat ? '#0f6e56' : '#1a1a1a', border: selectedCategory === cat ? '2px solid #0f6e56' : '1px solid #444', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '20px', fontWeight: '600' }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>4. Location</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {LOCATIONS.slice(0, 8).map(loc => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(loc)}
                    style={{ padding: '10px', background: selectedLocation === loc ? '#0f6e56' : '#1a1a1a', border: selectedLocation === loc ? '2px solid #0f6e56' : '1px solid #444', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                    📍 {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>5. Your phone</div>
              <input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="77 123 45 67"
                style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: 'white' }}
              />
            </div>

            {/* Price */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>6. Price</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="2000"
                  style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', color: 'white' }}
                />
                <div style={{ padding: '12px', background: '#333', borderRadius: '8px', color: '#999', fontWeight: '600' }}>F</div>
              </div>
            </div>

          </div>

          {/* Button */}
          <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '12px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button 
              onClick={() => setCurrentTab('browse')}
              style={{ flex: 1, padding: '14px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button 
              onClick={handleListIt}
              style={{ flex: 1, padding: '14px', background: '#0f6e56', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>List It</button>
          </div>
        </div>
      </div>
    );
  }

  // HOME/BROWSE PAGE VIEW (default)
  const uniqueLocations = getUniqueLocations();
  
  return (
    <div style={{ background: '#1a1a1a', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', margin: '0' }}>
      <div style={{ background: '#1a1a1a', borderRadius: '0', overflow: 'hidden', width: '100%', height: '100vh', boxShadow: 'none', display: 'flex', flexDirection: 'column', color: 'white' }}>
        
        {/* Sticky header */}
        <div style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #085041 100%)', color: 'white', padding: '16px', borderBottom: '1px solid #333', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Sunu Market</div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              onClick={() => setSelectedLocationFilter('All')}
              style={{ padding: '6px 14px', background: selectedLocationFilter === 'All' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap', border: '1px solid ' + (selectedLocationFilter === 'All' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'), fontWeight: '600', cursor: 'pointer', color: 'white' }}>
              All
            </button>
            {uniqueLocations.map(loc => (
              <button
                key={loc}
                onClick={() => setSelectedLocationFilter(loc)}
                style={{ padding: '6px 14px', background: selectedLocationFilter === loc ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '11px', whiteSpace: 'nowrap', border: '1px solid ' + (selectedLocationFilter === loc ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'), fontWeight: '600', cursor: 'pointer', color: 'white' }}>
                📍 {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable shelves */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          
          {/* Shelf: Fish */}
          {listingsByCategory('Yeet').length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #0f6e56', color: 'white' }}>🐟 Fish</div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {listingsByCategory('Yeet').map(listing => (
                  <div 
                    key={listing.id}
                    onClick={() => {
                      setSelectedListing(listing);
                      setCurrentPhotoIndex(0);
                    }}
                    style={{ minWidth: '90px', background: '#242424', border: '1px solid #333', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px', backgroundImage: listing.photos[0] ? `url(${listing.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '6px' }}>
                      {!listing.photos[0] && '🐟'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'white' }}>{listing.category}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shelf: Vegetables */}
          {listingsByCategory('Taaxat').length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #1D9E75', color: 'white' }}>🥬 Vegetables</div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {listingsByCategory('Taaxat').map(listing => (
                  <div 
                    key={listing.id}
                    onClick={() => {
                      setSelectedListing(listing);
                      setCurrentPhotoIndex(0);
                    }}
                    style={{ minWidth: '90px', background: '#242424', border: '1px solid #333', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px', backgroundImage: listing.photos[0] ? `url(${listing.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '6px' }}>
                      {!listing.photos[0] && '🥬'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'white' }}>{listing.category}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shelf: Fruits */}
          {listingsByCategory('Pampe').length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #D4A574', color: 'white' }}>🍌 Fruits</div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {listingsByCategory('Pampe').map(listing => (
                  <div 
                    key={listing.id}
                    onClick={() => {
                      setSelectedListing(listing);
                      setCurrentPhotoIndex(0);
                    }}
                    style={{ minWidth: '90px', background: '#242424', border: '1px solid #333', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px', backgroundImage: listing.photos[0] ? `url(${listing.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '6px' }}>
                      {!listing.photos[0] && '🍌'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'white' }}>{listing.category}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shelf: Rice */}
          {listingsByCategory('Jeep').length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #B8860B', color: 'white' }}>🍚 Rice</div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                {listingsByCategory('Jeep').map(listing => (
                  <div 
                    key={listing.id}
                    onClick={() => {
                      setSelectedListing(listing);
                      setCurrentPhotoIndex(0);
                    }}
                    style={{ minWidth: '90px', background: '#242424', border: '1px solid #333', borderRadius: '10px', padding: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '8px', backgroundImage: listing.photos[0] ? `url(${listing.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '6px' }}>
                      {!listing.photos[0] && '🍚'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'white' }}>{listing.category}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f6e56' }}>{listing.price} F</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listings.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: '80px', color: '#666' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <div>No listings yet</div>
            </div>
          )}

        </div>

        {/* Sticky bottom button */}
        <div style={{ background: '#242424', borderTop: '1px solid #333', padding: '12px 16px', flexShrink: 0 }}>
          <button 
            onClick={() => setCurrentTab('create')}
            style={{ width: '100%', padding: '12px', background: '#0f6e56', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>🎤 Record</button>
        </div>

      </div>
    </div>
  );
}