export interface Operator {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  created_at: string;
  auth_user_id: string | null;
}

export interface OperatorBasic {
  id: string;
  name: string;
  active: boolean;
}

export interface SafetyAlert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  operator_id: string | null;
  created_by: string | null;
  read: boolean;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  creator?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface ActivityRow {
  id: string;
  date: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_tag: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  notes: string | null;
  transit_start: string | null;
  transit_end: string | null;
  equipment_photo_url: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  created_at: string;
  operator_id: string;
  checklist_id: string | null;
  operators: { name: string } | null;
}

export interface ChecklistRow {
  id: string;
  machine_name: string;
  date: string;
  status: string;
  result: string | null;
  brand: string | null;
  model: string | null;
  tag: string | null;
  shift: string | null;
  max_load_capacity: string | null;
  inspector_name: string | null;
  inspector_registration: string | null;
  notes: string | null;
  end_notes: string | null;
  ended_at: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  created_at: string;
  operator_id: string;
  operators: { name: string } | null;
  equipment_types: { name: string } | null;
  equipment_photo_1_url: string | null;
  equipment_photo_2_url: string | null;
  equipment_photo_3_url: string | null;
  equipment_photo_4_url: string | null;
  environment_photo_url: string | null;
}

export interface ChecklistResponseRow {
  id: string;
  status: string;
  photo_url: string | null;
  notes: string | null;
  response_value: string | null;
  checklist_template_items: {
    description: string;
    section: string | null;
    is_blocking: boolean;
    order_index: number;
  } | null;
  machine_checklist_items: {
    description: string;
    section: string | null;
    is_blocking: boolean;
    order_index: number;
  } | null;
}

export interface Machine {
  id: string;
  name: string;
  tag: string | null;
  max_load_capacity: string | null;
  serial_number: string | null;
  notes: string | null;
  qr_code: string | null;
  active: boolean;
  created_at: string;
  items_count?: number;
}

export type ResponseType = 'yes_no' | 'yes_no_na' | 'text' | 'photo' | 'numeric';

export interface ChecklistItem {
  id: string;
  machine_id: string;
  order_index: number;
  section: string | null;
  description: string;
  is_blocking: boolean;
  response_type: ResponseType;
}
