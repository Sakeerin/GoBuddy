# Business Rules Document
## GoBuddy - Itinerary Constraints & Replan Rules

### Itinerary Constraints

#### 1. Time Constraints
- **ห้ามจัดกิจกรรมหลังเวลาปิด**: กิจกรรมต้องเริ่มและจบก่อนเวลาปิดของสถานที่
- **Buffer ระหว่างย้ายจุด**: ต้องมี buffer ขั้นต่ำ X นาที (default: 15 นาที) ระหว่างกิจกรรม
- **เวลาทำการ**: ตรวจสอบเวลาเปิด-ปิดของแต่ละ POI และไม่จัดกิจกรรมนอกเวลาทำการ
- **Daily Time Window**: เคารพเวลาที่ผู้ใช้ตั้งไว้ (เช่น 10:00-20:00)

#### 2. Distance Constraints
- **เดินทางรวมต่อวันไม่เกิน limit**: ถ้าผู้ใช้ตั้ง max_walking_km_per_day = 5, ระบบต้องไม่ให้เดินรวมเกิน 5 กม./วัน
- **Multi-modal optimization**: ถ้าระยะทางไกลเกินไป ต้องเสนอ transit/taxi แทน

#### 3. Budget Constraints
- **งบรวมไม่เกินงบตั้งไว้**: ถ้าเลือก optimize mode, ระบบต้องตัด/แทนที่ด้วยทางเลือกถูกกว่า
- **Cost confidence**: แสดง estimated vs fixed price และอัปเดตเมื่อมีข้อมูลใหม่

#### 4. Activity Constraints
- **Pin items ห้ามย้าย/แทนที่**: Items ที่ pin ไว้ต้องคงที่ใน itinerary
- **Duration respect**: เคารพ avg_duration_minutes ของแต่ละ POI
- **Sequential logic**: กิจกรรมต้องเรียงตามลำดับเวลาและสถานที่

#### 5. Traveler Constraints
- **Children/Seniors**: ถ้ามีเด็กเล็ก/ผู้สูงอายุ ต้องมีเวลา "พัก" เพิ่มเติม
- **Accessibility**: ถ้ามีข้อจำกัดการเดิน ต้องหลีกเลี่ยงกิจกรรมที่ต้องเดินมาก
- **Dietary restrictions**: ถ้ามีข้อจำกัดอาหาร ต้องไม่แนะนำร้านที่ขัดแย้ง

### Booking Constraints

#### 1. Price Change Threshold
- **ราคาเปลี่ยนเกิน threshold**: ถ้าราคาเปลี่ยนเกิน X% (default: 10%) จากที่แสดงไว้ ต้องขอ confirm ใหม่ก่อนจอง
- **Price lock**: ราคาที่แสดงต้องมี validity period และเตือนถ้าใกล้หมดอายุ

#### 2. Refund Policy
- **Policy transparency**: ต้องแสดง refund policy ชัดเจนก่อนจอง
- **Non-flexible policy warning**: ถ้า refund policy ไม่ยืดหยุ่น (เช่น non-refundable) ต้องเตือนก่อนจอง
- **Cancellation deadline**: แสดง deadline สำหรับยกเลิกฟรี

#### 3. Provider Fallback
- **Provider down**: ถ้า provider ล่ม ต้อง fallback provider อื่นหรือ "reserve later"
- **Retry logic**: Booking ที่ fail ต้อง retry ตาม exponential backoff
- **Alternative suggestions**: ถ้าจองล้มเหลว ต้องเสนอทางเลือกทันที (ราคาใกล้เคียง/เวลาใกล้เคียง)

#### 4. Booking State Machine
```
pending → confirmed
pending → failed
confirmed → canceled (with refund logic)
confirmed → refunded
```

### Replan Rules

#### 1. Minimize Disruption
- **Pin items protection**: Pin items ห้ามย้าย/แทนที่
- **Change only necessary parts**: เปลี่ยนเฉพาะส่วนที่จำเป็น (minimize disruption)
- **Preserve user preferences**: เคารพ preferences ที่ผู้ใช้ตั้งไว้

#### 2. Diff Clarity
- **แสดง diff ชัดเจน**: ต้องแสดงสิ่งที่ถูกแทนที่/ถูกย้าย/ถูกเพิ่ม/ถูกลบ
- **Impact summary**: แสดงผลกระทบด้านเวลา/งบ/ระยะทาง
- **Visual comparison**: แสดงเปรียบเทียบแผนเก่า vs ใหม่

#### 3. Transactional Apply
- **Atomic operation**: Apply replan ต้องเป็น atomic transaction
- **No partial updates**: ต้องไม่เกิดสถานะกลางค้าง (partial update)
- **Rollback capability**: Rollback ได้ถ้าพลาด
- **Version snapshot**: เก็บ snapshot ของ version เก่าก่อน apply

#### 4. Proposal Quality
- **Multiple options**: เสนอ 1-3 ตัวเลือก (default: 3)
- **Score ranking**: แต่ละ proposal ต้องมี score และเรียงตาม score
- **Explanation**: แต่ละ proposal ต้องมี explanation ว่าทำไมเสนอตัวเลือกนี้

### Event Trigger Rules

#### 1. Weather Triggers
- **Heavy rain + outdoor activity**: ฝนหนักช่วงกิจกรรม outdoor → เสนอ indoor alt
- **Severity levels**: 
  - Low: แจ้งเตือนแต่ไม่ต้อง replan
  - Medium: เสนอ replan แต่ไม่บังคับ
  - High: แนะนำ replan แบบบังคับ

#### 2. Closure Triggers
- **Place closed**: สถานที่ปิด → เสนอ slot/วันอื่น หรือกิจกรรมคล้ายกัน
- **Hours changed**: เวลาเปิดเปลี่ยน → ปรับ itinerary ให้สอดคล้อง

#### 3. Availability Triggers
- **Sold out**: ตั๋วเต็ม → เสนอ slot/วันอื่น หรือกิจกรรมคล้ายกัน
- **Limited availability**: ตั๋วเหลือน้อย → แจ้งเตือนให้รีบจอง

#### 4. Transport Triggers
- **Delay**: ขนส่งดีเลย์ → ปรับทั้งวันและแจ้งเตือน
- **Cancellation**: ยกเลิก → เสนอทางเลือกทันที

### Validation Rules

#### 1. Itinerary Validation
- **Time feasibility**: ตรวจสอบว่าเวลาทั้งหมดเป็นไปได้
- **Distance feasibility**: ตรวจสอบว่าระยะทางเป็นไปได้
- **Budget feasibility**: ตรวจสอบว่างบเป็นไปได้
- **Opening hours**: ตรวจสอบว่าเคารพเวลาเปิด-ปิด

#### 2. Booking Validation
- **Item exists**: ตรวจสอบว่า itinerary item ยังมีอยู่
- **Not already booked**: ตรวจสอบว่ายังไม่ได้จอง
- **Price still valid**: ตรวจสอบว่าราคายังใช้ได้

#### 3. Replan Validation
- **Proposal exists**: ตรวจสอบว่า proposal ยังใช้ได้
- **No conflicts**: ตรวจสอบว่าไม่มี conflict กับ booking ที่ confirmed แล้ว
- **User permission**: ตรวจสอบว่าผู้ใช้มีสิทธิ์ apply replan

### Conflict Resolution

#### 1. Concurrent Edits
- **Last-write-wins**: การแก้ไขพร้อมกันใช้ last-write-wins
- **Change log**: เก็บ change log สำหรับ audit
- **Lock per day**: ถ้าต้องการ strict consistency ใช้ lock per day

#### 2. Booking Conflicts
- **Double booking prevention**: ป้องกันการจองซ้ำด้วย idempotency key
- **Price change handling**: ถ้าราคาเปลี่ยนระหว่างจอง ต้องขอ confirm ใหม่

#### 3. Replan Conflicts
- **Booking protection**: ถ้ามี confirmed booking แล้ว ต้องไม่ replan ส่วนนั้น
- **User override**: ผู้ใช้สามารถ override replan ได้

