
import { useState } from "react";
import "./App.css";

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showVolunteer, setShowVolunteer] = useState(false);

  const [formData, setFormData] = useState({
    user_id: 1,
    location_id: 1,
    request_type: "WATER",
    description: "",
    severity: 1,
    people_affected: 1
  });

  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState(null);

  const [volunteerRequests, setVolunteerRequests] = useState([]);
  const [volunteerMessage, setVolunteerMessage] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // ---------------- REQUEST HELP ----------------

  const submitRequest = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...formData,
            user_id: Number(formData.user_id),
            location_id: Number(formData.location_id),
            severity: Number(formData.severity),
            people_affected: Number(formData.people_affected)
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(
          `Request submitted successfully. Request ID: ${data.request_id}`
        );

        setPriority({
          requestId: data.request_id,
          score: data.priority_score,
          level: data.priority
        });

        setFormData({
          user_id: 1,
          location_id: 1,
          request_type: "WATER",
          description: "",
          severity: 1,
          people_affected: 1
        });
      } else {
        setMessage("Failed to submit request.");
      }
    } catch (error) {
      setMessage(
        "Unable to connect to the ResQSync backend. Make sure FastAPI is running."
      );
    }
  };

  // ---------------- VOLUNTEER ----------------

  const openVolunteerDashboard = async () => {
    setShowForm(false);
    setShowVolunteer(true);
    setVolunteerMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/volunteer/requests"
      );

      const data = await response.json();

      if (response.ok) {
        setVolunteerRequests(data);
      } else {
        setVolunteerMessage("Unable to load emergency requests.");
      }
    } catch (error) {
      setVolunteerMessage(
        "Unable to connect to the ResQSync backend."
      );
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/volunteer/accept/${requestId}?volunteer_id=1`,
        {
          method: "POST"
        }
      );

      const data = await response.json();

      if (response.ok) {
        setVolunteerMessage(
          `Request #${requestId} accepted successfully!`
        );

        setVolunteerRequests(
          volunteerRequests.filter(
            (request) => request.request_id !== requestId
          )
        );
      } else {
        setVolunteerMessage(
          data.detail || "Unable to accept request."
        );
      }
    } catch (error) {
      setVolunteerMessage(
        "Unable to connect to the ResQSync backend."
      );
    }
  };

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div className="logo">
          ResQSync
        </div>

        <nav>
          <a href="#home">Home</a>
          <a href="#about">About</a>
        </nav>

      </header>

      <main>

        {/* HERO */}

        <section className="hero" id="home">

          <div className="hero-content">

            <h1>
              Disaster Response, Coordinated.
            </h1>

            <p>
              ResQSync connects affected people, volunteers,
              NGOs, and relief resources to coordinate emergency
              response faster.
            </p>

            <div className="buttons">

              <button
                className="primary-button"
                onClick={() => {
                  setShowForm(true);
                  setShowVolunteer(false);
                  setMessage("");
                  setPriority(null);
                }}
              >
                Request Help
              </button>

              <button
                className="secondary-button"
                onClick={openVolunteerDashboard}
              >
                Volunteer
              </button>

            </div>

          </div>

        </section>

        {/* REQUEST HELP */}

        {showForm && (

          <section className="request-section">

            <div className="request-form-container">

              <h2>
                Request Emergency Help
              </h2>

              <p>
                Provide the details below so that your request
                can be coordinated.
              </p>

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
                    Request ID:
                    <strong>
                      #{priority.requestId}
                    </strong>
                  </p>

                  <p>
                    Priority Score:
                    <strong>
                      {priority.score}
                    </strong>
                  </p>

                  <p>
                    Priority Level:
                    <strong>
                      {priority.level}
                    </strong>
                  </p>

                  <p>
                    Status:
                    <strong>
                      PENDING
                    </strong>
                  </p>

                </div>

              )}

            </div>

          </section>

        )}

        {/* VOLUNTEER DASHBOARD */}

        {showVolunteer && (

          <section className="request-section">

            <div className="request-form-container">

              <h2>
                Volunteer Dashboard
              </h2>

              <p>
                View emergency requests that need assistance.
              </p>

              {volunteerMessage && (

                <div className="message">
                  {volunteerMessage}
                </div>

              )}

              {volunteerRequests.length === 0 ? (

                <p>
                  No pending emergency requests available.
                </p>

              ) : (

                volunteerRequests.map((request) => (

                  <div
                    className="priority-result"
                    key={request.request_id}
                  >

                    <h3>
                      {request.request_type}
                    </h3>

                    <p>
                      <strong>
                        Request ID:
                      </strong>{" "}
                      #{request.request_id}
                    </p>

                    <p>
                      <strong>
                        Description:
                      </strong>{" "}
                      {request.description}
                    </p>

                    <p>
                      <strong>
                        People Affected:
                      </strong>{" "}
                      {request.people_affected}
                    </p>

                    <p>
                      <strong>
                        Severity:
                      </strong>{" "}
                      {request.severity}
                    </p>

                    <p>
                      <strong>
                        Priority Score:
                      </strong>{" "}
                      {request.priority_score}
                    </p>

                    <p>
                      <strong>
                        Status:
                      </strong>{" "}
                      {request.status}
                    </p>

                    <button
                      className="primary-button submit-button"
                      onClick={() =>
                        acceptRequest(request.request_id)
                      }
                    >
                      Accept Request
                    </button>

                  </div>

                ))

              )}

            </div>

          </section>

        )}

        {/* ABOUT */}

        <section
          className="features"
          id="about"
        >

          <h2>
            How ResQSync Helps
          </h2>

          <div className="feature-container">

            <div className="feature-card">

              <h3>
                Emergency Requests
              </h3>

              <p>
                Affected people can submit requests for
                essential emergency assistance.
              </p>

            </div>

            <div className="feature-card">

              <h3>
                Smart Prioritization
              </h3>

              <p>
                Requests can be prioritized according to
                severity and people affected.
              </p>

            </div>

            <div className="feature-card">

              <h3>
                Volunteer Coordination
              </h3>

              <p>
                Volunteers can view and accept suitable
                emergency requests.
              </p>

            </div>

            <div className="feature-card">

              <h3>
                Resource Tracking
              </h3>

              <p>
                Relief organizations can monitor available
                resources and shortages.
              </p>

            </div>

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



