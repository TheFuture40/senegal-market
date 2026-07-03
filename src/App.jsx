import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Common Dakar markets/neighborhoods
const LOCATIONS = [
  'Sandaga',
  'Pikine',
  'HLM',
  'Medina',
  'Fass',
  'Plateau',
  'Sacré-Cœur',
  'Parcelles',
  'Liberté',
  'Mermoz',
  'Ngor',
  'Yoff',
  'Ouakam',
  'Other'
];

export default function App() {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState('');
  const [listings, setListings] = useState([]);
  const [currentTab, setCurrentTab] = useState('create');
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterLocation, setFilterLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load listings from Supabase on app start
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

      // Convert base64 back to usable format
      const formattedListings = data.map(listing => ({
        id: listing.id,
        photo: listing.photo_data,
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
    } finally {
      setLoading(false);
    }
  };

  // Start recording voice note
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

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle photo from file
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger camera
  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  // Trigger file picker
  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Convert blob to base64
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

  // Create listing and save to Supabase
  const handleListIt = async () => {
    if (!audioBlob || !photo || !selectedCategory || !selectedLocation || !phone || !price) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Convert audio blob to base64
      const audioBase64 = await blobToBase64(audioBlob);
      
      // Save to Supabase
      const { data, error } = await supabase
        .from('listings')
        .insert([
          {
            category: selectedCategory,
            location: selectedLocation,
            phone: phone,
            price: price,
            photo_data: photo,
            audio_data: audioBase64
          }
        ])
        .select();

      if (error) throw error;

      // Reload listings
      await loadListings();

      // Reset form
      setAudioBlob(null);
      setPhoto(null);
      setSelectedCategory(null);
      setSelectedLocation(null);
      setPhone('');
      setPrice('');
      
      alert('Listing created!');
    } catch (err) {
      console.error('Error creating listing:', err);
      alert('Error creating listing. Try again.');
    }
  };

  // Delete listing from Supabase
  const deleteListing = async (id) => {
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from local state
      setListings(listings.filter(listing => listing.id !== id));
    } catch (err) {
      console.error('Error deleting listing:', err);
      alert('Error deleting listing.');
    }
  };

  const categoryIcons = {
    Jeun: '🐟',
    Jepp: '🍚',
    Loujum: '🥬',
    Fruits: '🍌',
    'Roots & Tubers': '🥔',
    Nenn: '🥚',
    'Spices & Nuts': '🌰',
    Other: '📦'
  };

  // Get unique locations from listings
  const uniqueLocations = [...new Set(listings.map(l => l.location))].sort();

  // Filter listings based on both category and location
  const filteredListings = listings.filter(listing => 
    (filterCategory === null || listing.category === filterCategory) &&
    (filterLocation === null || listing.location === filterLocation)
  );

  return (
    <div className="app">
      <header className="header">
        <h1>Sunu Market</h1>
        <p>Sell fresh goods by voice</p>
      </header>

      <nav className="tabs">
        <button 
          className={`tab ${currentTab === 'create' ? 'active' : ''}`}
          onClick={() => setCurrentTab('create')}
        >
          ➕ Create
        </button>
        <button 
          className={`tab ${currentTab === 'browse' ? 'active' : ''}`}
          onClick={() => setCurrentTab('browse')}
        >
          👀 Lufi Am ({listings.length})
        </button>
      </nav>

      <main className="container">
        {/* CREATE TAB */}
        {currentTab === 'create' && (
          <section className="form-section">
            <h2>Listel Fii</h2>

            {/* Voice Recording */}
            <div className="form-group">
              <label>Recordel li ngay Jaay</label>
              <div className="recording-controls">
                {!isRecording ? (
                  <button 
                    className="btn btn-record"
                    onClick={startRecording}
                  >
                    🎤 Record
                  </button>
                ) : (
                  <button 
                    className="btn btn-recording"
                    onClick={stopRecording}
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
              {audioBlob && <p className="success">✓ Voice note recorded</p>}
            </div>

            {/* Photo Upload */}
            <div className="form-group">
              <label>Add Photo</label>
              <div className="photo-buttons">
                <button 
                  className="btn btn-photo"
                  onClick={triggerCamera}
                >
                  📷 Take Photo
                </button>
                <button 
                  className="btn btn-photo"
                  onClick={triggerFilePicker}
                >
                  🖼 Choose Photo
                </button>
              </div>
              
              {/* Hidden file inputs */}
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
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />

              {photo && (
                <div className="photo-preview">
                  <img src={photo} alt="preview" />
                </div>
              )}
            </div>

            {/* Category Buttons */}
            <div className="form-group">
              <label>Loy Jaay?</label>
              <div className="category-buttons">
                {Object.keys(categoryIcons).map(cat => (
                  <button
                    key={cat}
                    className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <span className="icon">{categoryIcons[cat]}</span>
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="form-group">
              <label>Where are you selling?</label>
              <div className="location-buttons">
                {LOCATIONS.map(loc => (
                  <button
                    key={loc}
                    className={`location-btn ${selectedLocation === loc ? 'active' : ''}`}
                    onClick={() => setSelectedLocation(loc)}
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label>Sa Numero</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 77 123 45 67"
                className="phone-input"
              />
            </div>

            {/* Price */}
            <div className="form-group">
              <label>Price (CFA)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 2000"
                className="price-input"
              />
            </div>

            {/* Submit Button */}
            <button 
              className="btn btn-list-it"
              onClick={handleListIt}
            >
              List It
            </button>
          </section>
        )}

        {/* BROWSE TAB */}
        {currentTab === 'browse' && (
          <section className="browse-section">
            <h2>Available Listings</h2>
            
            {/* Category Filter */}
            <div className="filter-section">
              <h3 className="filter-title">By Category</h3>
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${filterCategory === null ? 'active' : ''}`}
                  onClick={() => setFilterCategory(null)}
                >
                  All
                </button>
                {Object.keys(categoryIcons).map(cat => (
                  <button
                    key={cat}
                    className={`filter-btn ${filterCategory === cat ? 'active' : ''}`}
                    onClick={() => setFilterCategory(cat)}
                  >
                    {categoryIcons[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Filter */}
            <div className="filter-section">
              <h3 className="filter-title">By Location</h3>
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${filterLocation === null ? 'active' : ''}`}
                  onClick={() => setFilterLocation(null)}
                >
                  All
                </button>
                {uniqueLocations.map(loc => (
                  <button
                    key={loc}
                    className={`filter-btn ${filterLocation === loc ? 'active' : ''}`}
                    onClick={() => setFilterLocation(loc)}
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading listings...</div>
            ) : listings.length === 0 ? (
              <div className="empty-state">
                <p>No listings yet. Be the first to list!</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="empty-state">
                <p>No listings match your filters.</p>
              </div>
            ) : (
              <div className="listings-grid">
                {filteredListings.map(listing => (
                  <div key={listing.id} className="listing-card">
                    {/* Photo */}
                    <div className="listing-photo">
                      <img src={listing.photo} alt="listing" />
                    </div>

                    {/* Category and Price */}
                    <div className="listing-info">
                      <div className="category-badge">
                        {categoryIcons[listing.category]} {listing.category}
                      </div>
                      <div className="location-badge">
                        📍 {listing.location}
                      </div>
                      <div className="price">
                        {listing.price} CFA
                      </div>
                      <div className="timestamp">
                        {listing.timestamp}
                      </div>
                    </div>

                    {/* Voice Player */}
                    <div className="voice-player">
                      <audio 
                        controls 
                        src={listing.audioUrl}
                      />
                    </div>

                    {/* Contact Buttons */}
                    {/* Contact Buttons */}
{listing.phone && (
  <div className="contact-buttons">
    <a 
      href={`tel:${listing.phone}`}
      className="btn btn-call"
    >
      ☎ Call
    </a>
    <a 
      href={`https://wa.me/221${listing.phone.replace(/\s/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-whatsapp"
    >
      💬 WhatsApp
    </a>
  </div>
)}

                    {/* Delete Button */}
                    <button 
                      className="btn btn-delete"
                      onClick={() => deleteListing(listing.id)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}