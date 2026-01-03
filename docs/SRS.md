# Software Requirements Specification (SRS)
## GoBuddy - Functional & Non-Functional Requirements

### 2) Requirements เชิงฟังก์ชัน (Functional Requirements)

#### 2.1 Account & Identity

**FR-ACC-01** สมัคร/เข้าสู่ระบบด้วย Email/OTP หรือ OAuth (Google/Apple)

**FR-ACC-02** โปรไฟล์ผู้ใช้: ภาษา, สกุลเงิน, หน่วยระยะทาง, ข้อจำกัดอาหาร/การเดิน, ความชอบ (budget/comfort/adventure)

**FR-ACC-03** ผู้ใช้สามารถใช้งานแบบ Guest ได้ (จำกัดฟีเจอร์) และ "ย้ายทริปเข้าบัญชี" ได้

**Acceptance:**
- Guest สร้างแผนได้ แต่จอง/บันทึกถาวรต้องล็อกอิน
- เปลี่ยนภาษา/สกุลเงินแล้วคำนวณใหม่และแสดงผลถูกต้อง

#### 2.2 Trip Setup (การตั้งค่าทริป)

**FR-TRP-01** กรอก: จุดหมาย (เมือง/ประเทศ), วันเริ่ม-จบ, จำนวนคน, งบรวม/ต่อวัน, สไตล์ทริป, เวลาเดินทางต่อวัน (เช่น 10:00–20:00)

**FR-TRP-02** ตั้งข้อจำกัด: เดินไม่เกิน X กม./วัน, เด็กเล็ก, ผู้สูงอายุ, ต้องมีเวลา "พัก", หลีกเลี่ยงฝูงชน/พื้นที่เสี่ยง

**FR-TRP-03** เลือกประเภททริป: City break / Nature / Theme / Workation / Family

**Acceptance:**
- เปลี่ยนพารามิเตอร์แล้ว itinerary regenerate ได้ โดยเก็บสิ่งที่ pin ไว้

#### 2.3 Places & POI Discovery

**FR-POI-01** ค้นหา POI/สถานที่/ร้านอาหาร พร้อมข้อมูล: เวลาเปิด-ปิด, ค่าตั๋ว, ระยะเวลาเที่ยว, rating, tags

**FR-POI-02** แสดงบนแผนที่ + list view + filter (budget, distance, open now, kid friendly)

**FR-POI-03** ผู้ใช้ "ปักหมุด"/save POI เข้าทริปได้

**Acceptance:**
- POI ที่เลือกต้องถูกใช้ใน itinerary และมีเวลาจริง + ระยะทางจริง

#### 2.4 Itinerary Builder (หัวใจ)

**FR-ITN-01** สร้าง itinerary รายวันอัตโนมัติ (Auto-plan) ตามเวลาเปิด-ปิด + ระยะทาง + ระยะเวลาเที่ยว + งบ

**FR-ITN-02** ผู้ใช้แก้เองได้: ลากวาง reorder, เพิ่ม/ลบ, pin item (ห้ามย้าย), ตั้งเวลาเอง

**FR-ITN-03** ระบบต้องคำนวณ:
- เวลาเดินทาง (travel time) ระหว่างกิจกรรม
- เวลาบัฟเฟอร์/พัก
- ค่าใช้จ่ายต่อวัน/รวม (ตั๋ว+เดินทางในเมือง+อาหารประมาณการ)

**FR-ITN-04** สร้าง "แผนสำรอง (backup plan)" ต่อวันได้ (เช่น ฝนตก = indoor plan)

**Acceptance:**
- ถ้าย้ายกิจกรรม ระบบปรับเวลาทั้งวันและเตือนหากทำไม่ทัน/สถานที่ปิด

#### 2.5 Route & Transportation (การเดินทาง/เส้นทาง)

**FR-RT-01** สร้างเส้นทางแนะนำระหว่าง POIs (walking/transit/taxi) พร้อมเวลา/ค่าใช้จ่าย

**FR-RT-02** รองรับ multi-modal: เดิน + รถไฟ + รถเมล์

**FR-RT-03** คำนวณ ETA แบบมีความไม่แน่นอน (range) และเสนอ buffer

**Acceptance:**
- เมื่อเลือกวิธีเดินทางอื่น ค่าใช้จ่ายและตารางเวลาต้องเปลี่ยนตาม

#### 2.6 Costing & Budget

**FR-BGT-01** สรุปค่าใช้จ่ายเป็นหมวด: ที่พัก, กิจกรรม, เดินทาง, อาหาร, อื่น ๆ

**FR-BGT-02** ตั้งงบแล้วระบบ "optimize" แผนให้ไม่เกินงบ (ตัด/แทนที่ด้วยทางเลือกถูกกว่า)

**FR-BGT-03** แสดง "ความมั่นใจของราคา" (estimated vs fixed) และอัปเดตราคาเมื่อมีข้อมูลใหม่

**Acceptance:**
- งบต้องสอดคล้องกับ itinerary และแสดงราคาต่อคน/รวมได้

#### 2.7 Booking (จองครบ)

แนะนำทำแบบ "เชื่อมพาร์ทเนอร์" เป็นหลัก (affiliate/OTA/Activity platform) แล้วค่อยเพิ่ม direct booking

**FR-BKG-01** จองที่พัก/กิจกรรมจาก itinerary ได้ (เลือก provider)

**FR-BKG-02** สถานะการจอง: pending/confirmed/failed/canceled/refunded

**FR-BKG-03** เก็บหลักฐาน: booking reference, voucher, policy (ยกเลิก/คืนเงิน)

**FR-BKG-04** หากจองล้มเหลว ต้องเสนอทางเลือกทันที (ราคาใกล้เคียง/เวลาใกล้เคียง)

**Acceptance:**
- Booking ที่ confirmed ต้องผูกกับ itinerary item และ sync เวลา/ที่อยู่ถูกต้อง

#### 2.8 Real-time Event Monitoring (เหตุการณ์จริง)

**FR-EVT-01** ติดตามอากาศตาม location & time slot

**FR-EVT-02** ติดตามสถานะ: สถานที่ปิด/เวลาเปิดเปลี่ยน, ตั๋วเต็ม, ขนส่งดีเลย์ (ถ้าข้อมูลมี)

**FR-EVT-03** ตั้งระดับความรุนแรง (severity) และ trigger กฎ:
- ฝนหนักช่วงกิจกรรม outdoor → เสนอ indoor alt
- ตั๋วเต็ม → เสนอ slot/วันอื่น หรือกิจกรรมคล้ายกัน
- ดีเลย์ → ปรับทั้งวันและแจ้งเตือน

**Acceptance:**
- เมื่อเกิดเหตุการณ์ ระบบต้องสร้าง "Replan Proposal" พร้อมผลกระทบและให้ผู้ใช้กดยืนยัน

#### 2.9 Re-planning Engine (ปรับแผนอัตโนมัติ)

**FR-RPL-01** สร้างข้อเสนอแผนใหม่ (1–3 ตัวเลือก) พร้อม:
- เวลาใหม่
- ค่าใช้จ่ายเปลี่ยน
- ระยะเดินทางเพิ่ม/ลด
- สิ่งที่ถูกแทนที่/ถูกย้าย

**FR-RPL-02** "Apply" แผนใหม่แบบ transactional (ทำแล้ว itinerary ต้อง consistent)

**FR-RPL-03** เก็บประวัติการปรับแผน (versioning)

**Acceptance:**
- Apply แล้วไม่เกิดสถานะกลางค้าง (partial update) และ rollback ได้ถ้าพลาด

#### 2.10 Collaboration & Sharing

**FR-COL-01** แชร์ทริปให้เพื่อน (view-only / edit)

**FR-COL-02** โหวตกิจกรรม/โหวตตัวเลือก replan

**FR-COL-03** comment ต่อวัน/ต่อกิจกรรม

**Acceptance:**
- การแก้ไขพร้อมกันต้องมี conflict strategy (last-write-wins + change log หรือ lock per day)

#### 2.11 Travel Execution Mode (ใช้งานระหว่างเดินทาง)

**FR-EXE-01** "Today view" แบบ timeline พร้อมปุ่มนำทาง

**FR-EXE-02** Offline mode (อย่างน้อยอ่าน itinerary + แผนที่ cache)

**FR-EXE-03** Checklist: เอกสาร, ของใช้, ตั๋ว, ที่อยู่ฉุกเฉิน

**Acceptance:**
- ไม่มีเน็ตยังเปิด itinerary ได้ และมีข้อมูลหลักครบ

#### 2.12 Admin Console

**FR-ADM-01** จัดการ POI curated lists, tags, city guides

**FR-ADM-02** จัดการ providers (API keys, commission rules), webhook logs

**FR-ADM-03** เครื่องมือ support: ดู booking status, resend voucher, manual override

### 3) Requirements เชิงคุณภาพ (Non-Functional Requirements)

#### Performance

- สร้าง itinerary ครั้งแรก: < 10 วินาที (MVP) / < 5 วินาที (เป้าหมาย)
- Replan proposal: < 5 วินาที
- Search POI: < 2 วินาที p95

#### Reliability

- Booking workflow มี idempotency + retry
- Event monitoring มี queue + backoff
- SLA sync provider: อัปเดตภายใน 1–5 นาที

#### Security & Privacy

- Token/keys เข้ารหัส at rest
- PCI: ถ้ารับชำระเองต้องทำ compliance (แนะนำใช้ payment provider/redirect)
- RBAC admin/support
- Data minimization: เก็บเฉพาะจำเป็น

#### Observability

- Structured logs + trace id ต่อ booking
- Dashboard: booking success rate, provider latency, replan triggers

