
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { TrendingUp, FileSpreadsheet, HardHat } from 'lucide-react';
import Modal from '@/components/Modal';
import Papa from 'papaparse';
import styles from './inventory.module.css';

export default function InventoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [towers, setTowers] = useState([]);
  const [selectedTower, setSelectedTower] = useState(null);
  
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewingUnit, setViewingUnit] = useState(null);

  // Creation Modals
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [towerModalOpen, setTowerModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', location: '', status: 'under_construction' });
  const [towerForm, setTowerForm] = useState({ name: '', total_floors: '' });
  const [saving, setSaving] = useState(false);
  const [roiModalOpen, setRoiModalOpen] = useState(false);
  const [roiForm, setRoiForm] = useState({ propertyValue: 5000000, expectedRent: 25000, appreciationRate: 5, holdingPeriod: 5 });

  useEffect(() => {
    if (user) loadInitial();
  }, [user]);

  // When project selector changes, reload towers + units together
  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    setTowers([]);
    setUnits([]);
    loadTowersAndUnits(projectId);
  };

  // When tower tab changes, only reload units
  const handleTowerChange = (towerId) => {
    setSelectedTower(towerId);
    setUnits([]);
    loadUnits(towerId);
  };

  // Load projects, then immediately load towers+units for the first project — single waterfall
  const loadInitial = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      const projectList = data || [];
      setProjects(projectList);

      if (projectList.length > 0) {
        const firstProjectId = projectList[0].id;
        setSelectedProject(firstProjectId);
        await loadTowersAndUnits(firstProjectId);
      }
    } catch (err) {
      toast.error('Failed to load projects. Did you run the SQL migration?');
    } finally {
      setLoading(false);
    }
  };

  // Load towers for a project + units for the first tower in one go
  const loadTowersAndUnits = async (projectId) => {
    try {
      const { data: towerData, error: towerError } = await supabase
        .from('towers')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (towerError) throw towerError;

      const towerList = towerData || [];
      setTowers(towerList);

      if (towerList.length > 0) {
        const firstTowerId = towerList[0].id;
        setSelectedTower(firstTowerId);
        await loadUnits(firstTowerId);
      } else {
        setSelectedTower(null);
        setUnits([]);
      }
    } catch (err) {
      toast.error('Failed to load towers');
    }
  };

  const loadUnits = async (towerId) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('tower_id', towerId)
        .order('unit_number');
      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      toast.error('Failed to load inventory');
    }
  };

  const handleStatusChange = async (unitId, newStatus) => {
    try {
      const { error } = await supabase.from('units').update({ status: newStatus }).eq('id', unitId);
      if (error) throw error;
      toast.success(`Unit status updated to ${newStatus}`);
      setViewingUnit({ ...viewingUnit, status: newStatus });
      loadUnits(selectedTower);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleCreateProject = async () => {
    if (!projectForm.name) return toast.warning('Project name is required');
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').insert([{ 
        name: projectForm.name, 
        location: projectForm.location, 
        status: projectForm.status,
        user_id: user?.id 
      }]);
      if (error) throw error;
      toast.success('Project created successfully');
      setProjectModalOpen(false);
      setProjectForm({ name: '', location: '', status: 'under_construction' });
      loadInitial();
    } catch (err) {
      toast.error(`Error: ${err?.message || 'Failed to create project'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTower = async () => {
    if (!towerForm.name || !towerForm.total_floors) return toast.warning('Name and total floors are required');
    if (!selectedProject) return toast.warning('Select a project first');
    setSaving(true);
    try {
      const { error } = await supabase.from('towers').insert([{ 
        name: towerForm.name, 
        total_floors: Number(towerForm.total_floors), 
        project_id: selectedProject 
      }]);
      if (error) throw error;
      toast.success('Tower created successfully');
      setTowerModalOpen(false);
      setTowerForm({ name: '', total_floors: '' });
      loadTowersAndUnits(selectedProject);
    } catch (err) {
      toast.error(`Error: ${err?.message || 'Failed to create tower'}`);
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "unit_number,floor_number,bhk_type,carpet_area,base_price,floor_rise_charge,amenities_charge\n101,1,2 BHK,850,5000000,0,100000\n102,1,3 BHK,1200,7500000,0,150000";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory_upload_template.csv';
    link.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTower) return;
    
    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          if (rows.length === 0) throw new Error("CSV is empty");
          
          const newUnits = rows.map(row => ({
            tower_id: selectedTower,
            unit_number: row.unit_number,
            floor_number: Number(row.floor_number),
            bhk_type: row.bhk_type,
            carpet_area: Number(row.carpet_area) || 0,
            base_price: Number(row.base_price) || 0,
            floor_rise_charge: Number(row.floor_rise_charge) || 0,
            amenities_charge: Number(row.amenities_charge) || 0,
            status: 'available'
          }));

          // Ensure unit numbers are not completely empty
          if (newUnits.some(u => !u.unit_number || isNaN(u.floor_number))) {
            throw new Error("Invalid format: unit_number and floor_number are required.");
          }

          const { error } = await supabase.from('units').insert(newUnits);
          if (error) throw error;

          toast.success(`Successfully imported ${newUnits.length} units!`);
          loadUnits(selectedTower);
        } catch (err) {
          toast.error(err.message || 'Error processing CSV file');
        } finally {
          setUploading(false);
          e.target.value = ''; // reset input
        }
      },
      error: (err) => {
        toast.error('Failed to parse CSV');
        setUploading(false);
      }
    });
  };

  const formatCurrency = (val) => val ? `₹${Number(val).toLocaleString('en-IN')}` : '-';


  // Group units by floor
  const floors = {};
  units.forEach(u => {
    if (!floors[u.floor_number]) floors[u.floor_number] = [];
    floors[u.floor_number].push(u);
  });
  
  // Sort floors descending to render bottom-to-top visually (done in CSS flex column-reverse, so just map normally)
  const floorNumbers = Object.keys(floors).map(Number).sort((a, b) => a - b);

  const calculateROI = () => {
    const { propertyValue, expectedRent, appreciationRate, holdingPeriod } = roiForm;
    const annualRent = expectedRent * 12;
    const grossYield = (annualRent / propertyValue) * 100;
    const futureValue = propertyValue * Math.pow(1 + (appreciationRate / 100), holdingPeriod);
    const capitalGain = futureValue - propertyValue;
    const totalRentalIncome = annualRent * holdingPeriod;
    const totalReturn = capitalGain + totalRentalIncome;
    const annualizedROI = (Math.pow((propertyValue + totalReturn) / propertyValue, 1 / holdingPeriod) - 1) * 100;

    return {
      grossYield: grossYield.toFixed(2),
      futureValue: futureValue.toFixed(0),
      totalReturn: totalReturn.toFixed(0),
      annualizedROI: annualizedROI.toFixed(2)
    };
  };

  const roiMetrics = calculateROI();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Inventory Management</h1>
          <p className="text-muted">Live builder inventory and price sheets</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setRoiModalOpen(true)}><TrendingUp size={16} style={{ marginRight: 8 }} /> ROI Calculator</button>
          <button className="btn btn-primary" onClick={() => setProjectModalOpen(true)}>+ Add Project</button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state card">
          <HardHat size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>No Projects Found</h3>
          <p>You need to add a Project and Tower to get started.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setProjectModalOpen(true)}>Create First Project</button>
        </div>
      ) : (
        <>
          <div className={styles.projectSelector}>
            <label style={{ fontWeight: 600 }}>Select Project:</label>
            <select className="form-select" style={{ width: 250 }} value={selectedProject || ''} onChange={e => handleProjectChange(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.status.replace(/_/g, ' ')})</option>)}
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className={styles.towerTabs}>
                {towers.length === 0 ? <span className="text-muted">No towers found for this project.</span> : null}
                {towers.map(t => (
                  <button 
                    key={t.id} 
                    className={`${styles.towerTab} ${selectedTower === t.id ? styles.towerTabActive : ''}`}
                    onClick={() => handleTowerChange(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setTowerModalOpen(true)}>+ Add Tower</button>
              </div>

              {selectedTower && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}><FileSpreadsheet size={14} style={{ marginRight: 6 }} /> CSV Template</button>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? 'Uploading...' : '📥 Bulk Upload'}
                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              )}
            </div>

            <div style={{ padding: 24 }}>
              <div className={styles.legend}>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.colorAvailable}`}></div> Available</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.colorBlocked}`}></div> Blocked</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.colorBooked}`}></div> Booked</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.colorSold}`}></div> Sold</div>
              </div>

              {units.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No units added to this tower yet.
                </div>
              ) : (
                <div className={styles.inventoryGrid}>
                  {floorNumbers.map(floor => (
                    <div key={floor} className={styles.floorRow}>
                      <div className={styles.floorLabel}>
                        {floor === 0 ? 'GF' : `${floor}F`}
                      </div>
                      <div className={styles.unitsContainer}>
                        {floors[floor].map(unit => (
                          <div 
                            key={unit.id} 
                            className={`${styles.unitBox} ${styles['status_' + unit.status]}`}
                            onClick={() => unit.status !== 'sold' && setViewingUnit(unit)}
                            title={`${unit.bhk_type} - ${formatCurrency(unit.total_price)}`}
                          >
                            <span className={styles.unitNumber}>{unit.unit_number}</span>
                            <span className={styles.unitType}>{unit.bhk_type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Price Sheet & Unit Details Modal */}
      <Modal
        isOpen={!!viewingUnit}
        onClose={() => setViewingUnit(null)}
        title={`Unit Details: ${viewingUnit?.unit_number}`}
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setViewingUnit(null)}>Close</button>
            {viewingUnit?.status === 'available' && (
              <button className="btn" style={{ background: 'var(--warning)', color: 'white' }} onClick={() => handleStatusChange(viewingUnit.id, 'blocked')}>
                Block Unit (24h)
              </button>
            )}
            {viewingUnit?.status !== 'sold' && (
              <button className="btn btn-primary" onClick={() => handleStatusChange(viewingUnit.id, 'booked')}>
                Mark as Booked
              </button>
            )}
          </>
        }
      >
        {viewingUnit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-elevated)', padding: 16, borderRadius: 0 }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type</div>
                <div style={{ fontWeight: 600 }}>{viewingUnit.bhk_type}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Carpet Area</div>
                <div style={{ fontWeight: 600 }}>{viewingUnit.carpet_area} sq.ft.</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Floor</div>
                <div style={{ fontWeight: 600 }}>{viewingUnit.floor_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize', color: `var(--${viewingUnit.status === 'available' ? 'success' : 'primary'})` }}>
                  {viewingUnit.status}
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Price Sheet Breakdown</h3>
              <div className={styles.priceSheet}>
                <div className={styles.priceRow}>
                  <span>Base Price</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(viewingUnit.base_price)}</span>
                </div>
                <div className={styles.priceRow}>
                  <span>Floor Rise Charge</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(viewingUnit.floor_rise_charge)}</span>
                </div>
                <div className={styles.priceRow}>
                  <span>Amenities Charge</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(viewingUnit.amenities_charge)}</span>
                </div>
                <div className={styles.priceRowTotal}>
                  <span>Total Unit Value</span>
                  <span>{formatCurrency(viewingUnit.total_price)}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                * Excluding GST & Registration charges
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Project Modal */}
      <Modal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title="Add New Project"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setProjectModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateProject} disabled={saving}>
              {saving ? 'Saving...' : 'Create Project'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder="e.g. Skyline Residency" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value})}>
              <option value="pre_launch">Pre Launch</option>
              <option value="under_construction">Under Construction</option>
              <option value="ready_to_move">Ready to Move</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={projectForm.location} onChange={e => setProjectForm({...projectForm, location: e.target.value})} placeholder="e.g. Sector 150" />
          </div>
        </div>
      </Modal>

      {/* Add Tower Modal */}
      <Modal
        isOpen={towerModalOpen}
        onClose={() => setTowerModalOpen(false)}
        title="Add New Tower"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTowerModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateTower} disabled={saving}>
              {saving ? 'Saving...' : 'Create Tower'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Tower Name *</label>
            <input className="form-input" value={towerForm.name} onChange={e => setTowerForm({...towerForm, name: e.target.value})} placeholder="e.g. Tower A" />
          </div>
          <div className="form-group">
            <label className="form-label">Total Floors *</label>
            <input className="form-input" type="number" value={towerForm.total_floors} onChange={e => setTowerForm({...towerForm, total_floors: e.target.value})} placeholder="e.g. 20" />
          </div>
        </div>
      </Modal>

      {/* ROI Calculator Modal */}
      <Modal
        isOpen={roiModalOpen}
        onClose={() => setRoiModalOpen(false)}
        title="Investor ROI Calculator"
        size="md"
        footer={<button className="btn btn-secondary" onClick={() => setRoiModalOpen(false)}>Close</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Property Value (₹)</label>
              <input type="number" className="form-input" value={roiForm.propertyValue} onChange={e => setRoiForm({...roiForm, propertyValue: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Monthly Rent (₹)</label>
              <input type="number" className="form-input" value={roiForm.expectedRent} onChange={e => setRoiForm({...roiForm, expectedRent: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Appreciation Rate (% per yr)</label>
              <input type="number" className="form-input" value={roiForm.appreciationRate} onChange={e => setRoiForm({...roiForm, appreciationRate: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Holding Period (Years)</label>
              <input type="number" className="form-input" value={roiForm.holdingPeriod} onChange={e => setRoiForm({...roiForm, holdingPeriod: Number(e.target.value)})} />
            </div>
          </div>

          <div style={{ marginTop: 16, background: 'var(--bg-secondary)', padding: 16, borderRadius: 0 }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--primary)' }}>Projection Results</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gross Rental Yield</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{roiMetrics.grossYield}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Annualized ROI (CAGR)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--success)' }}>{roiMetrics.annualizedROI}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Future Property Value</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>₹{Number(roiMetrics.futureValue).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Net Profit</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--success)' }}>₹{Number(roiMetrics.totalReturn).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
