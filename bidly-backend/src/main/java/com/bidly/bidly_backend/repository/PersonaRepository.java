package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Persona;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonaRepository extends JpaRepository<Persona, Long> {
}
