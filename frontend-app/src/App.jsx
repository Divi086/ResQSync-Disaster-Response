import { useState ,useEffect} from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup
} from "react-leaflet";

import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});

const API = "http://127.0.0.1:8000";

function App() {
  // =====================================================
  // AUTHENTICATION
  // =====================================================

  const [authMode, setAuthMode] = useState("login");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const [authData, setAuthData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "AFFECTED_PERSON",
  });

  const [authMessage, setAuthMessage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  // =====================================================
// NAVIGATION
// =====================================================

const navigateTo = (sectionId) => {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

  // =====================================================
  // LOCATION
  // =====================================================

  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  // =====================================================
  // AFFECTED PERSON
  // =====================================================

  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [requestMessage, setRequestMessage] = useState("");

  const [formData, setFormData] = useState({
    request_type: "WATER",
    description: "",
    severity: 1,
    people_affected: 1,
  });

  // =====================================================
  // VOLUNTEER
  // =====================================================

  const [volunteerRequests, setVolunteerRequests] = useState([]);
  const [volunteerMessage, setVolunteerMessage] = useState("");

  // =====================================================
  // AUTH INPUT
  // =====================================================

  const handleAuthChange = (e) => {
    setAuthData({
      ...authData,
      [e.target.name]: e.target.value,
    });
  };

  // =====================================================
  // GET CURRENT LOCATION
  // =====================================================

  const getCurrentLocation = () => {
  setLocationLoading(true);
  setLocationMessage("");

  if (!navigator.geolocation) {
    setLocationMessage("Geolocation is not supported.");
    setLocationLoading(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      console.log("REAL GPS:", newLocation); // Check browser console

      setLocation(newLocation);

      setLocationMessage(
        `📍 Current Location: ${newLocation.latitude.toFixed(6)}, ${newLocation.longitude.toFixed(6)}`
      );

      setLocationLoading(false);
    },

    (error) => {
      console.log(error);

      setLocationLoading(false);

      if (error.code === 1) {
        setLocationMessage("Please allow location permission.");
      } else if (error.code === 2) {
        setLocationMessage("Unable to detect your location.");
      } else {
        setLocationMessage("Location request timed out.");
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0, // VERY IMPORTANT
    }
  );
};

  // =====================================================
  // LOGIN
  // =====================================================

  const login = async () => {
    setAuthMessage("");

    if (!authData.email || !authData.password) {
      setAuthMessage("Please enter email and password.");
      return;
    }

    try {
      const url =
        `${API}/login` +
        `?email=${encodeURIComponent(authData.email)}` +
        `&password=${encodeURIComponent(authData.password)}`;

      const response = await fetch(url, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthMessage(
          data.detail || "Invalid email or password."
        );
        return;
      }

      setUser(data);
      setIsLoggedIn(true);
      setAuthMessage("");

      // Detect location after login
      getCurrentLocation();
    } catch (error) {
      console.error(error);

      setAuthMessage(
        "Unable to connect to the ResQSync backend. Make sure FastAPI is running."
      );
    }
  };

  // =====================================================
  // SIGNUP
  // =====================================================

  const signup = async () => {
    setAuthMessage("");

    if (
      !authData.name ||
      !authData.email ||
      !authData.phone ||
      !authData.password
    ) {
      setAuthMessage("Please fill all required fields.");
      return;
    }

    try {
      const url =
        `${API}/signup` +
        `?name=${encodeURIComponent(authData.name)}` +
        `&email=${encodeURIComponent(authData.email)}` +
        `&phone=${encodeURIComponent(authData.phone)}` +
        `&password=${encodeURIComponent(authData.password)}` +
        `&role=${encodeURIComponent(authData.role)}`;

      const response = await fetch(url, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthMessage(
          data.detail || "Signup failed."
        );
        return;
      }

      setAuthMessage(
        "Signup successful! Please login."
      );

      setAuthMode("login");

      setAuthData({
        name: "",
        email: authData.email,
        phone: "",
        password: "",
        role: authData.role,
      });
    } catch (error) {
      console.error(error);

      setAuthMessage(
        "Unable to connect to the ResQSync backend. Make sure FastAPI is running."
      );
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);

    setLocation(null);
    setLocationMessage("");

    setVolunteerRequests([]);
    setMyRequests([]);

    setAuthData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "AFFECTED_PERSON",
    });

    setAuthMessage("");
  };

  // =====================================================
  // SEND VOLUNTEER LOCATION TO BACKEND
  // =====================================================

  const updateVolunteerLocation = async () => {
    if (!user?.volunteer_id || !location) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/volunteer/location` +
          `?volunteer_id=${user.volunteer_id}` +
          `&latitude=${location.latitude}` +
          `&longitude=${location.longitude}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Volunteer location update failed:",
          data
        );
      }
    } catch (error) {
      console.error(
        "Unable to update volunteer location:",
        error
      );
    }
  };

  // =====================================================
  // UPDATE VOLUNTEER LOCATION WHEN GPS CHANGES
  // =====================================================

  useEffect(() => {
    if (
      user?.role === "VOLUNTEER" &&
      user?.volunteer_id &&
      location
    ) {
      updateVolunteerLocation();
    }
  }, [location, user]);

  // =====================================================
  // LOAD AFFECTED PERSON REQUESTS
  // =====================================================

  const loadMyRequests = async () => {
    if (
      !user?.user_id ||
      user.role !== "AFFECTED_PERSON"
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/requests/user/${user.user_id}`
      );

      const data = await response.json();

      if (response.ok) {
        setMyRequests(data);
        setRequestMessage("");
      } else {
        setRequestMessage(
          data.detail ||
            "Unable to load your emergency requests."
        );
      }
    } catch (error) {
      console.error(error);

      setRequestMessage(
        "Unable to connect to the ResQSync backend."
      );
    }
  };

  // =====================================================
  // AUTO LOAD REQUESTS
  // =====================================================

  useEffect(() => {
    if (user?.role === "AFFECTED_PERSON") {
      loadMyRequests();
    }
  }, [user]);

  // =====================================================
  // AUTO REFRESH REQUESTS
  // =====================================================

  useEffect(() => {
    if (
      !user?.user_id ||
      user.role !== "AFFECTED_PERSON"
    ) {
      return;
    }

    const interval = setInterval(() => {
      loadMyRequests();
    }, 3000);

    return () => clearInterval(interval);
  }, [user]);

  // =====================================================
  // FORM CHANGE
  // =====================================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // =====================================================
  // SUBMIT EMERGENCY REQUEST
  // =====================================================

  const submitRequest = async (e) => {
    e.preventDefault();

    setMessage("");
    setPriority(null);

    if (!location) {
      setMessage(
        "Please detect your current location before submitting the emergency request."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API}/requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.user_id,

            request_type:
              formData.request_type,

            description:
              formData.description,

            severity:
              Number(formData.severity),

            people_affected:
              Number(formData.people_affected),

            latitude:
              location.latitude,

            longitude:
              location.longitude,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(
          `Emergency request submitted successfully. Request ID: ${data.request_id}`
        );

        setPriority({
          requestId: data.request_id,
          score: data.priority_score,
          level: data.priority,
        });

        setFormData({
          request_type: "WATER",
          description: "",
          severity: 1,
          people_affected: 1,
        });

        loadMyRequests();
      } else {
        setMessage(
          data.detail ||
            "Failed to submit emergency request."
        );
      }
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the ResQSync backend. Make sure FastAPI is running."
      );
    }
  };

  // =====================================================
  // LOAD VOLUNTEER REQUESTS
  // =====================================================

  const loadVolunteerRequests = async () => {
    setVolunteerMessage("");

    try {
      const response = await fetch(
        `${API}/volunteer/requests?volunteer_id=${user.volunteer_id}`
      );

      const data = await response.json();
      

      if (response.ok) {
        setVolunteerRequests(data);
      } else {
        setVolunteerMessage(
          data.detail ||
            "Unable to load emergency requests."
        );
      }
    } catch (error) {
      console.error(error);

      setVolunteerMessage(
        "Unable to connect to the ResQSync backend."
      );
    }
  };

  // =====================================================
  // ACCEPT REQUEST
  // =====================================================

  const acceptRequest = async (requestId) => {
  if (!user?.volunteer_id) {
    setVolunteerMessage("Volunteer ID is not available.");
    return;
  }

  try {
    const response = await fetch(
      `${API}/volunteer/accept/${requestId}` +
        `?volunteer_id=${user.volunteer_id}`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    console.log("ACCEPT RESPONSE:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      setVolunteerMessage(
        data.detail || "Unable to accept request."
      );
      return;
    }

    if (
      data.latitude != null &&
      data.longitude != null
    ) {
      setSelectedLocation({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        address: data.address || "Emergency location",
        city: data.city || ""
      });
    } else {
      console.log(
        "No affected-person coordinates returned:",
        data
      );

      setVolunteerMessage(
        `Request #${requestId} accepted, but location was not returned.`
      );
    }

    loadVolunteerRequests();

  } catch (error) {
    console.error(error);

    setVolunteerMessage(
      "Unable to connect to the ResQSync backend."
    );
  }
};

  // =====================================================
  // LOGIN / SIGNUP SCREEN
  // =====================================================

  if (!isLoggedIn) {
    return (
      <div className="app">

        <header className="header">

          <div className="logo">
            ResQSync
          </div>

          <nav>

            <button
              type="button"
              className={
                authMode === "login"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={
                authMode === "signup"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setAuthMode("signup");
                setAuthMessage("");
              }}
            >
              Signup
            </button>

          </nav>

        </header>

        <main>

          <section className="hero">

            <div className="hero-content">

              <h1>
                Disaster Response, Coordinated.
              </h1>

              <p>
                ResQSync connects affected people,
                volunteers, NGOs and relief resources
                to coordinate emergency response faster.
              </p>

            </div>

          </section>

          <section id="nearby-requests" className="request-section">

            <div className="request-form-container">

              <h2>
                {authMode === "login"
                  ? "Login to ResQSync"
                  : "Create ResQSync Account"}
              </h2>

              <p>
                {authMode === "login"
                  ? "Login to access your dashboard."
                  : "Join the ResQSync disaster response network."}
              </p>

              {authMode === "signup" && (
                <>
                  <label>Name</label>

                  <input
                    type="text"
                    name="name"
                    value={authData.name}
                    onChange={handleAuthChange}
                    placeholder="Enter your name"
                  />

                  <label>Phone</label>

                  <input
                    type="text"
                    name="phone"
                    value={authData.phone}
                    onChange={handleAuthChange}
                    placeholder="Enter phone number"
                  />

                  <label>Role</label>

                  <select
                    name="role"
                    value={authData.role}
                    onChange={handleAuthChange}
                  >
                    <option value="AFFECTED_PERSON">
                      Affected Person
                    </option>

                    <option value="VOLUNTEER">
                      Volunteer
                    </option>

                    <option value="NGO">
                      NGO
                    </option>
                  </select>
                </>
              )}

              <label>Email</label>

              <input
                type="email"
                name="email"
                value={authData.email}
                onChange={handleAuthChange}
                placeholder="Enter your email"
              />

              <label>Password</label>

              <input
                type="password"
                name="password"
                value={authData.password}
                onChange={handleAuthChange}
                placeholder="Enter your password"
              />

              {authMode === "login" ? (
                <button
                  type="button"
                  className="primary-button submit-button"
                  onClick={login}
                >
                  Login
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button submit-button"
                  onClick={signup}
                >
                  Create Account
                </button>
              )}

              {authMessage && (
                <div className="message">
                  {authMessage}
                </div>
              )}

              <p className="auth-switch">

                {authMode === "login" ? (
                  <>
                    Don't have an account?{" "}

                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthMessage("");
                      }}
                    >
                      Signup
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}

                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthMessage("");
                      }}
                    >
                      Login
                    </button>
                  </>
                )}

              </p>

            </div>

          </section>

        </main>

        <footer>
          <p>
            ResQSync — Disaster Response Coordination Platform
          </p>
        </footer>

      </div>
    );
  }

  // =====================================================
  // AFFECTED PERSON DASHBOARD
  // =====================================================

  if (user.role === "AFFECTED_PERSON") {
    return (
      <div className="app">

        <header className="header">

          <div className="logo">
            ResQSync
          </div>

          <nav>

  <button
    type="button"
    className="nav-button"
    onClick={() => navigateTo("dashboard")}
  >
    Dashboard
  </button>

  <button
    type="button"
    className="nav-button"
    onClick={() => navigateTo("requests")}
  >
    My Requests
  </button>

  <button
    type="button"
    className="nav-button"
    onClick={() => {
      setShowForm(true);
      setMessage("");
      setPriority(null);
      getCurrentLocation();

      setTimeout(() => {
        navigateTo("emergency-form");
      }, 100);
    }}
  >
    Request Help
          </button>

            <span>
               Welcome, {user.name}
            </span>

            <button
              type="button"
              className="nav-button"
              onClick={logout}
            >
              Logout
              </button>

          </nav>

        </header>

        <main>

           <section id="dashboard" className="hero">

            <div className="hero-content">

              <h1>
                Welcome, {user.name}
              </h1>

              <p>
                Request emergency assistance and get
                prioritized support quickly.
              </p>

              <div className="buttons">

                <button
  className="primary-button"
  onClick={() => {
    setShowForm(true);
    setMessage("");
    setPriority(null);

    getCurrentLocation();

    setTimeout(() => {
      navigateTo("emergency-form");
    }, 100);
  }}
>
  Request Emergency Help
</button>

                <button
                  className="secondary-button"
                  onClick={getCurrentLocation}
                >
                  {locationLoading
                    ? "Detecting..."
                    : "Detect My Location"}
                </button>

              </div>

              {locationMessage && (
                <div className="message">
                  {locationMessage}
                </div>
              )}

            </div>

          </section>

          <section id="requests" className="request-section">

            <div className="request-form-container">

              <h2>
                My Emergency Requests
              </h2>

              <button
                type="button"
                className="primary-button"
                onClick={loadMyRequests}
              >
                Refresh Status
              </button>

              {requestMessage && (
                <div className="message">
                  {requestMessage}
                </div>
              )}

              {myRequests.length === 0 ? (
                <p>
                  You have no emergency requests yet.
                </p>
              ) : (
  myRequests.map((request) => (
    <div className="request-card" key={request.request_id}>

      <div className="request-card-header">
        <div>
          <span className="request-type">
            {request.request_type}
          </span>

          <h3>
            Emergency Request #{request.request_id}
          </h3>
        </div>

        <span
          className={`status-badge status-${request.status
            ?.toLowerCase()
            .replace(/\s+/g, "-")}`}
        >
          {request.status}
        </span>
      </div>

      <p className="request-description">
        {request.description}
      </p>

      <div className="request-details">

        <div className="request-detail">
          <span>Severity</span>
          <strong className={`severity-${String(request.severity
            ?? "").toLowerCase()
            .replace(/\s+/g, "-")}`}>
            {request.severity}
          </strong>
        </div>

        <div className="request-detail">
          <span>People Affected</span>
          <strong>
            {request.people_affected}
          </strong>
        </div>

        <div className="request-detail">
          <span>Priority Score</span>
          <strong>
            {request.priority_score} / 100
          </strong>
        </div>

      </div>

    </div>
  ))
)}

          </div>

          </section>

          {showForm && (
             <section id="emergency-form" className="request-section">

              <div className="request-form-container">

                <h2>
                  Request Emergency Help
                </h2>

                <p>
                  Your current GPS location will be
                  attached to this emergency request.
                </p>

                {location && (
                  <div className="message">
                    📍 Current location detected
                    <br />
                    Latitude:{" "}
                    {location.latitude.toFixed(6)}
                    <br />
                    Longitude:{" "}
                    {location.longitude.toFixed(6)}
                  </div>
                )}

                <form onSubmit={submitRequest}>

                  <label>
                    Emergency Type
                  </label>

                  <select
                    name="request_type"
                    value={formData.request_type}
                    onChange={handleChange}
                  >
                    <option value="WATER">
                      Water
                    </option>

                    <option value="FOOD">
                      Food
                    </option>

                    <option value="MEDICINE">
                      Medicine
                    </option>

                    <option value="MEDICAL">
                      Medical
                    </option>

                    <option value="RESCUE">
                      Rescue
                    </option>

                    <option value="SHELTER">
                      Shelter
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>

                  <label>
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe what help is needed..."
                    required
                  />

                  <label>
                    Severity
                  </label>

                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleChange}
                  >
                    <option value="1">
                      1 - Low
                    </option>

                    <option value="2">
                      2 - Moderate
                    </option>

                    <option value="3">
                      3 - High
                    </option>

                    <option value="4">
                      4 - Very High
                    </option>

                    <option value="5">
                      5 - Critical
                    </option>
                  </select>

                  <label>
                    Number of People Affected
                  </label>

                  <input
                    type="number"
                    name="people_affected"
                    min="1"
                    value={formData.people_affected}
                    onChange={handleChange}
                    required
                  />

                  <button
                    type="submit"
                    className="primary-button submit-button"
                  >
                    Submit Emergency Request
                  </button>

                </form>

                {message && (
                  <div className="message">
                    {message}
                  </div>
                )}

                {priority && (
                  <div className="priority-result">

                    <h3>
                      Emergency Request Submitted
                    </h3>

                    <p>
                      Request ID:{" "}
                      <strong>
                        #{priority.requestId}
                      </strong>
                    </p>

                    <p>
                      Priority Score:{" "}
                      <strong>
                        {priority.score}
                      </strong>
                    </p>

                    <p>
                      Priority Level:{" "}
                      <strong>
                        {priority.level}
                      </strong>
                    </p>

                    <p>
                      Status:{" "}
                      <strong>
                        PENDING
                      </strong>
                    </p>

                  </div>
                )}

              </div>

            </section>
          )}

        </main>

        <footer>
          <p>
            ResQSync — Disaster Response Coordination Platform
          </p>
        </footer>

      </div>
    );
  }

  // =====================================================
  // VOLUNTEER DASHBOARD
  // =====================================================

  if (user.role === "VOLUNTEER") {
  return (
    <div className="app">

      <header className="header">

        <div className="logo">
          ResQSync
        </div>

        <nav>

  <button
    type="button"
    className="nav-button"
    onClick={() => navigateTo("volunteer-dashboard")}
  >
    Dashboard
  </button>

  <button
    type="button"
    className="nav-button"
    onClick={() => navigateTo("nearby-requests")}
  >
    Requests
  </button>

  {selectedLocation && (
    <button
      type="button"
      className="nav-button"
      onClick={() => navigateTo("affected-location")}
    >
      Location
    </button>
  )}

  <span>
    Volunteer: {user.name}
  </span>

  <button
    type="button"
    className="nav-button"
    onClick={logout}
  >
    Logout
  </button>

</nav>

      </header>


      <main>

        <section className="hero">

          <div className="hero-content">

            <h1>
              Volunteer Dashboard
            </h1>

            <p>
              Find nearby emergency requests and
              coordinate assistance.
            </p>

            <button
              className="primary-button"
              onClick={() => {
                getCurrentLocation();
                loadVolunteerRequests();
              }}
            >
              Find Nearby Requests
            </button>

            {locationMessage && (
              <div className="message">
                {locationMessage}
              </div>
            )}

          </div>

        </section>


        <section className="request-section">

          <div className="request-form-container">

            <h2>
              Nearby Emergency Requests
            </h2>

            <p>
              Requests are ordered by distance from
              your current location.
            </p>


            {volunteerMessage && (
              <div className="message">
                {volunteerMessage}
              </div>
            )}


            {volunteerRequests.length === 0 ? (

              <p>
                No pending emergency requests found.
              </p>

            ) : (

              volunteerRequests.map((request) => (

                <div
                  className="feature-card"
                  key={request.request_id}
                >

                  <h3>
                    Request #{request.request_id}
                  </h3>


                  <p>
                    Type:{" "}
                    <strong>
                      {request.request_type}
                    </strong>
                  </p>


                  <p>
                    Description:{" "}
                    {request.description}
                  </p>


                  <p>
                    Severity:{" "}
                    <strong>
                      {request.severity}
                    </strong>
                  </p>


                  <p>
                    People Affected:{" "}
                    <strong>
                      {request.people_affected}
                    </strong>
                  </p>


                  <p>
                    Priority Score:{" "}
                    <strong>
                      {request.priority_score}
                    </strong>
                  </p>


                  <p>
                    Distance:{" "}
                    <strong>
                      {request.distance_km !== null &&
                      request.distance_km !== undefined
                        ? `${request.distance_km} km`
                        : "Location unavailable"}
                    </strong>
                  </p>


                  <p>
                    Status:{" "}
                    <strong>
                      {request.status}
                    </strong>
                  </p>


                  <button
                    className="primary-button"
                    onClick={() =>
                      acceptRequest(
                        request.request_id
                      )
                    }
                  >
                    Accept Request
                  </button>

                </div>

              ))

            )}


            {/* =========================
                AFFECTED PERSON MAP
            ========================= */}

            {selectedLocation && (
               <div id="affected-location" className="map-section">

                <h2>
                  Affected Person Location
                </h2>

                <p>
                  Emergency location for the accepted request.
                </p>


                <MapContainer
                 center={[
                 Number(selectedLocation.latitude),
                 Number(selectedLocation.longitude)
                 ]}
                 zoom={15}
                 scrollWheelZoom={true}
                 style={{
                 height: "400px",
                 width: "100%",
                 borderRadius: "12px"
                 }}
                >

                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />


                  <Marker
                    position={[
                     Number(selectedLocation.latitude),
                     Number(selectedLocation.longitude)
                    ]}
                  >

                    <Popup>

                      <strong>
                        Affected Person
                      </strong>

                      <br />

                      {selectedLocation.address}

                      <br />

                      {selectedLocation.city}

                    </Popup>

                  </Marker>

                </MapContainer>


                <div className="location-details">

                  <p>
                    <strong>
                      Latitude:
                    </strong>{" "}
                    {selectedLocation.latitude}
                  </p>

                  <p>
                    <strong>
                      Longitude:
                    </strong>{" "}
                    {selectedLocation.longitude}
                  </p>

                  <p>
                    <strong>
                      Address:
                    </strong>{" "}
                    {selectedLocation.address}
                  </p>

                  <p>
                    <strong>
                      City:
                    </strong>{" "}
                    {selectedLocation.city}
                  </p>

                </div>

              </div>
            )}

          </div>

        </section>

      </main>


      <footer>

        <p>
          ResQSync — Disaster Response Coordination Platform
        </p>

      </footer>

    </div>
  );
}

  // =====================================================
  // NGO DASHBOARD
  // =====================================================

  return (
    <div className="app">

      <header className="header">

        <div className="logo">
          ResQSync
        </div>

        <nav>

          <span>
            NGO: {user.name}
          </span>

          <button
            type="button"
            className="nav-button"
            onClick={logout}
          >
            Logout
          </button>

        </nav>

      </header>

      <main>

        <section id="volunteer-dashboard" className="hero">

          <div className="hero-content">

            <h1>
              NGO Dashboard
            </h1>

            <p>
              Create events and coordinate volunteers
              for disaster relief activities.
            </p>

            <button className="primary-button">
              Create Volunteer Event
            </button>

          </div>

        </section>

      </main>

      <footer>
        <p>
          ResQSync — Disaster Response Coordination Platform
        </p>
      </footer>

    </div>
  );
}

export default App;



