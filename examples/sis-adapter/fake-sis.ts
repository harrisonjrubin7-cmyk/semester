// A stand-in for a school's student information system: the thing an adapter talks to.
// Everything here is in memory and invented. It is not a real SIS and not a model of any vendor's API.

export interface Slot {
  id: string;
  advisor: string;
  startsAt: string;
  /** The SIS's own revision counter. The adapter turns it into the record's `version`. */
  revision: number;
  bookedBy: string | null;
}

export interface Booking {
  id: string;
  slotId: string;
  studentId: string;
  topic: string;
  /** The key the caller gave when booking. This is what makes `findByKey` possible. */
  key: string;
}

export class FakeSis {
  /** Student ids this SIS knows, mapped to whether they have a hold on their account. */
  students = new Map<string, { hold: boolean }>();
  slots: Slot[] = [];
  bookings: Booking[] = [];
  /** Test switch: perform the next booking, then fail as if the answer was lost on the wire. */
  loseNextResponse = false;
  /** Test switch: the SIS is down for everything. */
  down = false;

  private ensureUp() {
    if (this.down) throw new Error('sis: connect ECONNREFUSED 10.0.0.12:1521'); // an ordinary failure, not a Refusal
  }

  student(id: string) {
    this.ensureUp();
    return this.students.get(id) ?? null;
  }

  slot(id: string): Slot | null {
    this.ensureUp();
    return this.slots.find((s) => s.id === id) ?? null;
  }

  /** Books a slot. Calling it again with the same key returns the first booking and writes nothing. */
  book(slotId: string, studentId: string, topic: string, key: string): Booking {
    this.ensureUp();
    const earlier = this.bookings.find((b) => b.key === key);
    if (earlier) return earlier;
    const slot = this.slot(slotId);
    if (!slot || slot.bookedBy) throw new Error('slot unavailable');
    slot.bookedBy = studentId;
    slot.revision += 1;
    const booking = { id: `bk-${this.bookings.length + 1}`, slotId, studentId, topic, key };
    this.bookings.push(booking);
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new Error('sis: socket hang up'); // the write happened; the caller cannot know
    }
    return booking;
  }

  findByKey(key: string): Booking | null {
    this.ensureUp();
    return this.bookings.find((b) => b.key === key) ?? null;
  }
}
