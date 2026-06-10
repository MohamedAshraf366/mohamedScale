import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Truck, 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Navigation,
  Fuel,
  Users,
  ArrowRight,
  Phone,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  useShipments, 
  useMarkAsDelivered, 
  useAtRiskSuppliers,
  getRowBackgroundColor 
} from '@/hooks/useLogistics';
import { useSupplierIssues } from '@/hooks/useSupplierIssues';
import DeliveryStatusBadge from '@/components/DeliveryStatusBadge';
import AtRiskSupplierBadge from '@/components/AtRiskSupplierBadge';
import IssueReportDialog from '@/components/IssueReportDialog';

// Mock data for fleet vehicles
const mockFleet = [
  { id: 'V001', name: 'Flatbed Truck 01', type: 'Flatbed', status: 'In Transit', driver: 'Ahmed Al-Rashid', phone: '+966 50 123 4567', location: 'Riyadh → Jeddah', fuel: 75, nextService: addDays(new Date(), 15) },
  { id: 'V002', name: 'Mixer Truck 01', type: 'Mixer', status: 'Available', driver: 'Mohammed Hassan', phone: '+966 50 234 5678', location: 'Riyadh Depot', fuel: 90, nextService: addDays(new Date(), 30) },
  { id: 'V003', name: 'Trailer 01', type: 'Trailer', status: 'In Transit', driver: 'Khalid Omar', phone: '+966 50 345 6789', location: 'Dammam → Riyadh', fuel: 45, nextService: addDays(new Date(), 5) },
  { id: 'V004', name: 'Box Truck 01', type: 'Box Truck', status: 'Maintenance', driver: 'Unassigned', phone: '-', location: 'Service Center', fuel: 60, nextService: new Date() },
  { id: 'V005', name: 'Van 01', type: 'Van', status: 'Available', driver: 'Saeed Ali', phone: '+966 50 456 7890', location: 'Jeddah Depot', fuel: 85, nextService: addDays(new Date(), 22) },
  { id: 'V006', name: 'Crane Flatbed 01', type: 'Crane-assisted Flatbed', status: 'In Transit', driver: 'Faisal Khan', phone: '+966 50 567 8901', location: 'Riyadh → Dammam', fuel: 55, nextService: addDays(new Date(), 10) },
];

// Mock data for shipments
const mockShipments = [
  { id: 'SH001', client: 'ABC Construction', origin: 'Riyadh Warehouse', destination: 'Jeddah Site A', status: 'In Transit', vehicle: 'V001', items: 'Steel Beams (50 tons)', eta: addHours(new Date(), 4), progress: 65 },
  { id: 'SH002', client: 'XYZ Builders', origin: 'Dammam Port', destination: 'Riyadh Central', status: 'In Transit', vehicle: 'V003', items: 'Cement (200 bags)', eta: addHours(new Date(), 2), progress: 80 },
  { id: 'SH003', client: 'Gulf Contractors', origin: 'Riyadh Depot', destination: 'Dammam Project', status: 'In Transit', vehicle: 'V006', items: 'Heavy Equipment', eta: addHours(new Date(), 6), progress: 35 },
  { id: 'SH004', client: 'Modern Homes', origin: 'Jeddah Warehouse', destination: 'Makkah Site', status: 'Pending', vehicle: 'V005', items: 'Tiles (500 sqm)', eta: addDays(new Date(), 1), progress: 0 },
  { id: 'SH005', client: 'Elite Projects', origin: 'Riyadh Central', destination: 'Khobar Office', status: 'Delivered', vehicle: 'V002', items: 'Office Furniture', eta: new Date(), progress: 100 },
  { id: 'SH006', client: 'Prime Development', origin: 'Dammam Depot', destination: 'Jubail Industrial', status: 'Pending', vehicle: '-', items: 'PVC Pipes (1000 units)', eta: addDays(new Date(), 2), progress: 0 },
];

// Mock data for delivery schedule
const mockSchedule = [
  { id: 'DS001', date: new Date(), time: '08:00', client: 'ABC Construction', destination: 'Jeddah', items: 'Steel Beams', status: 'Departed' },
  { id: 'DS002', date: new Date(), time: '10:00', client: 'XYZ Builders', destination: 'Riyadh', items: 'Cement', status: 'Departed' },
  { id: 'DS003', date: new Date(), time: '14:00', client: 'Gulf Contractors', destination: 'Dammam', items: 'Equipment', status: 'In Progress' },
  { id: 'DS004', date: addDays(new Date(), 1), time: '07:00', client: 'Modern Homes', destination: 'Makkah', items: 'Tiles', status: 'Scheduled' },
  { id: 'DS005', date: addDays(new Date(), 1), time: '09:00', client: 'Elite Projects', destination: 'Khobar', items: 'Furniture', status: 'Scheduled' },
  { id: 'DS006', date: addDays(new Date(), 2), time: '06:00', client: 'Prime Development', destination: 'Jubail', items: 'PVC Pipes', status: 'Scheduled' },
];

const Logistics = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // Fetch real shipment data
  const { data: shipments = [], isLoading: shipmentsLoading, refetch } = useShipments();
  const { data: atRiskSuppliers = [] } = useAtRiskSuppliers();
  const { data: supplierIssues = [] } = useSupplierIssues();
  const markAsDelivered = useMarkAsDelivered();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Transit':
      case 'In Progress':
      case 'Departed':
      case 'in_transit':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'Available':
      case 'Delivered':
      case 'delivered':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'Pending':
      case 'Scheduled':
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'Maintenance':
      case 'cancelled':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const fleetStats = {
    total: mockFleet.length,
    available: mockFleet.filter(v => v.status === 'Available').length,
    inTransit: mockFleet.filter(v => v.status === 'In Transit').length,
    maintenance: mockFleet.filter(v => v.status === 'Maintenance').length,
  };

  const shipmentStats = {
    total: shipments.length,
    inTransit: shipments.filter(s => s.status === 'in_transit').length,
    pending: shipments.filter(s => s.status === 'pending').length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    onTime: shipments.filter(s => s.delivery_status === 'on_time').length,
    slightlyDelayed: shipments.filter(s => s.delivery_status === 'slightly_delayed').length,
    criticallyDelayed: shipments.filter(s => s.delivery_status === 'critically_delayed').length,
  };

  const handleMarkDelivered = (shipmentId: string) => {
    markAsDelivered.mutate({ id: shipmentId, actualArrival: new Date() });
  };

  const filteredShipments = shipments.filter(s => 
    s.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.shipment_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.destination.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unresolvedIssues = supplierIssues.filter(i => !i.is_resolved);

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('logistics.title', 'Logistics & Fleet Management')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('logistics.description', 'Track deliveries, manage fleet, and monitor shipments')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIssueDialogOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              New Shipment
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{fleetStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Fleet</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{fleetStats.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xl font-bold text-blue-600">{fleetStats.inTransit}</p>
                <p className="text-xs text-muted-foreground">In Transit</p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{shipmentStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xl font-bold text-amber-600">{shipmentStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{shipmentStats.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Performance Stats */}
        {shipmentStats.delivered > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">On Time</p>
                    <p className="text-2xl font-bold text-green-600">{shipmentStats.onTime}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Slightly Delayed</p>
                    <p className="text-2xl font-bold text-amber-600">{shipmentStats.slightlyDelayed}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critically Delayed</p>
                    <p className="text-2xl font-bold text-red-600">{shipmentStats.criticallyDelayed}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">At Risk Suppliers</p>
                    <p className="text-2xl font-bold text-red-600">{atRiskSuppliers.length}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500/30" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
              <TabsTrigger value="shipments">Shipments</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="issues" className="relative">
                Issues
                {unresolvedIssues.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unresolvedIssues.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Active Deliveries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  Active Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shipments.filter(s => s.status === 'in_transit').length > 0 ? (
                    shipments.filter(s => s.status === 'in_transit').map((shipment) => (
                      <div key={shipment.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Truck className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{shipment.client_name}</p>
                            <Badge variant="outline" className={getStatusColor(shipment.status)}>
                              In Transit
                            </Badge>
                            {shipment.supplier?.is_at_risk && (
                              <AtRiskSupplierBadge 
                                isAtRisk={shipment.supplier.is_at_risk}
                                consecutiveOnTimeCount={shipment.supplier.consecutive_on_time_count}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{shipment.origin}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="truncate">{shipment.destination}</span>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{shipment.items_description || 'No description'}</span>
                              <span className="font-medium">{shipment.progress_percent}%</span>
                            </div>
                            <Progress value={shipment.progress_percent} className="h-1.5" />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium">ETA</p>
                          <p className="text-sm text-muted-foreground">
                            {shipment.scheduled_arrival ? format(new Date(shipment.scheduled_arrival), 'HH:mm') : '-'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No active deliveries</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Today's Schedule and Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Today's Deliveries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockSchedule.filter(s => format(s.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-bold">{item.time}</p>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.client}</p>
                          <p className="text-xs text-muted-foreground">{item.destination} • {item.items}</p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Alerts & At-Risk Suppliers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {atRiskSuppliers.length > 0 ? (
                      atRiskSuppliers.map((supplier) => (
                        <div key={supplier.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{supplier.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {5 - (supplier.consecutive_on_time_count || 0)} on-time deliveries to clear status
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                            At Risk
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">All Suppliers Healthy</p>
                          <p className="text-xs text-muted-foreground">No suppliers currently at risk</p>
                        </div>
                      </div>
                    )}
                    
                    {unresolvedIssues.slice(0, 3).map((issue) => (
                      <div key={issue.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <XCircle className="h-5 w-5 text-amber-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">{issue.issue_type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{issue.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fleet Tab */}
          <TabsContent value="fleet" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockFleet.map((vehicle) => (
                <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          vehicle.status === 'Available' ? 'bg-green-500/10' :
                          vehicle.status === 'In Transit' ? 'bg-blue-500/10' :
                          'bg-red-500/10'
                        }`}>
                          <Truck className={`h-5 w-5 ${
                            vehicle.status === 'Available' ? 'text-green-600' :
                            vehicle.status === 'In Transit' ? 'text-blue-600' :
                            'text-red-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">{vehicle.type}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Assign Driver</DropdownMenuItem>
                          <DropdownMenuItem>Schedule Maintenance</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Badge variant="outline" className={`${getStatusColor(vehicle.status)} mb-3`}>
                      {vehicle.status}
                    </Badge>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{vehicle.driver}</span>
                      </div>
                      {vehicle.phone !== '-' && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{vehicle.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{vehicle.location}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Fuel className="h-3 w-3" /> Fuel Level
                        </span>
                        <span className={vehicle.fuel < 50 ? 'text-amber-600 font-medium' : ''}>{vehicle.fuel}%</span>
                      </div>
                      <Progress value={vehicle.fuel} className={`h-1.5 ${vehicle.fuel < 50 ? '[&>div]:bg-amber-500' : ''}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Shipments Tab */}
          <TabsContent value="shipments" className="mt-6">
            <Card>
              <CardContent className="p-0">
                {shipmentsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading shipments...</div>
                ) : filteredShipments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No shipments found. Create your first shipment to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Delivery Status</TableHead>
                        <TableHead>ETA / Delivered</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShipments.map((shipment) => (
                        <TableRow 
                          key={shipment.id}
                          className={getRowBackgroundColor(shipment.delivery_status, shipment.status === 'delivered')}
                        >
                          <TableCell className="font-medium">{shipment.shipment_code || shipment.id.slice(0, 8)}</TableCell>
                          <TableCell>{shipment.client_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{shipment.supplier?.name || '-'}</span>
                              {shipment.supplier?.is_at_risk && (
                                <AtRiskSupplierBadge 
                                  isAtRisk={shipment.supplier.is_at_risk}
                                  consecutiveOnTimeCount={shipment.supplier.consecutive_on_time_count}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="truncate max-w-[80px]">{shipment.origin.split(' ')[0]}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{shipment.destination.split(' ')[0]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{shipment.items_description || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(shipment.status)}>
                              {shipment.status === 'in_transit' ? 'In Transit' : 
                               shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {shipment.status === 'delivered' ? (
                              <DeliveryStatusBadge 
                                status={shipment.delivery_status}
                                delayMinutes={shipment.delay_minutes}
                              />
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {shipment.status === 'delivered' && shipment.actual_arrival ? (
                              format(new Date(shipment.actual_arrival), 'MMM d, HH:mm')
                            ) : shipment.scheduled_arrival ? (
                              format(new Date(shipment.scheduled_arrival), 'MMM d, HH:mm')
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Track Shipment</DropdownMenuItem>
                                <DropdownMenuItem>Edit Details</DropdownMenuItem>
                                {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleMarkDelivered(shipment.id)}
                                    disabled={markAsDelivered.isPending}
                                  >
                                    Mark as Delivered
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-6">
            <div className="space-y-6">
              {[...new Set(mockSchedule.map(s => format(s.date, 'yyyy-MM-dd')))].map((dateStr) => {
                const daySchedule = mockSchedule.filter(s => format(s.date, 'yyyy-MM-dd') === dateStr);
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                
                return (
                  <Card key={dateStr}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        {isToday ? 'Today' : format(new Date(dateStr), 'EEEE, MMMM d')}
                        <Badge variant="secondary" className="ml-2">{daySchedule.length} deliveries</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {daySchedule.map((item) => (
                          <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <div className="text-center min-w-[60px] border-r pr-4">
                              <p className="text-lg font-bold">{item.time}</p>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{item.client}</p>
                                <Badge variant="outline" className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {item.destination}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {item.items}
                                </span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Supplier Issues Tracker
                </CardTitle>
              </CardHeader>
              <CardContent>
                {supplierIssues.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/30" />
                    <p>No supplier issues recorded</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supplierIssues.map((issue) => (
                      <div 
                        key={issue.id} 
                        className={`p-4 rounded-lg border ${
                          issue.is_resolved 
                            ? 'bg-muted/50 border-muted' 
                            : issue.severity === 'critical'
                            ? 'bg-red-500/10 border-red-500/20'
                            : issue.severity === 'major'
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-yellow-500/10 border-yellow-500/20'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{issue.supplier?.name || 'Unknown Supplier'}</p>
                              <Badge 
                                variant="outline" 
                                className={
                                  issue.severity === 'critical' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                  issue.severity === 'major' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                  'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                }
                              >
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {issue.issue_type.replace('_', ' ')}
                              </Badge>
                              {issue.is_resolved && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Created: {format(new Date(issue.created_at), 'MMM d, yyyy HH:mm')}
                              {issue.resolved_at && ` • Resolved: ${format(new Date(issue.resolved_at), 'MMM d, yyyy HH:mm')}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Issue Report Dialog */}
      <IssueReportDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        source="manual_ops"
      />
    </Layout>
  );
};

export default Logistics;
