package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.*;
import com.bidly.bidly_backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AuctionFinalizerService {

    @Autowired private ItemCatalogoRepository itemCatalogoRepository;
    @Autowired private PujoFechaRepository pujoFechaRepository;
    @Autowired private PujaRepository pujaRepository;
    @Autowired private RegistroDeSubastaRepository registroDeSubastaRepository;
    @Autowired private SubastaRepository subastaRepository;
    @Autowired private NotificacionService notificacionService;

    @Scheduled(fixedDelay = 60000)
    public void finalizarItemsVencidos() {
        LocalDateTime limite = LocalDateTime.now().minusMinutes(30);
        List<ItemCatalogo> activos = itemCatalogoRepository.findItemsActivosEnSubastasAbiertas();

        for (ItemCatalogo item : activos) {
            Optional<LocalDateTime> ultimaFecha = pujoFechaRepository.findUltimaFechaByItemId(item.getIdentificador());
            if (ultimaFecha.isEmpty() || ultimaFecha.get().isAfter(limite)) continue;

            Optional<Puja> topPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(item.getIdentificador());
            if (topPuja.isEmpty()) continue;

            Puja ganadora = topPuja.get();
            ganadora.setGanador("si");
            pujaRepository.save(ganadora);

            item.setSubastado("si");
            itemCatalogoRepository.save(item);

            RegistroDeSubasta registro = new RegistroDeSubasta();
            Subasta subasta = item.getCatalogo().getSubasta();
            registro.setSubasta(subasta);
            registro.setProducto(item.getProducto().getIdentificador());
            registro.setDuenio(item.getProducto().getDuenio());
            registro.setCliente(ganadora.getAsistente().getCliente());
            registro.setImporte(ganadora.getImporte());
            registro.setComision(item.getComision());
            registroDeSubastaRepository.save(registro);

            boolean todosFinalizados = itemCatalogoRepository
                    .findByCatalogoSubastaIdentificador(subasta.getIdentificador())
                    .stream().allMatch(i -> "si".equals(i.getSubastado()));
            if (todosFinalizados) {
                subasta.setEstado("cerrada");
                subastaRepository.save(subasta);
            }

            Cliente ganador = ganadora.getAsistente().getCliente();
            String producto = item.getProducto().getDescripcionCatalogo();
            notificacionService.crear(ganador.getIdentificador(), "ganaste",
                    "Ganaste " + producto + " por $" + ganadora.getImporte());

            long pendientes = itemCatalogoRepository
                    .findByCatalogoSubastaIdentificador(subasta.getIdentificador())
                    .stream()
                    .filter(i -> !"si".equals(i.getSubastado()))
                    .count();
            if (pendientes == 1) {
                notificacionService.notificarAsistentesSubasta(subasta.getIdentificador(), "subasta_por_cerrar",
                        "Queda 1 ítem en la subasta #" + subasta.getIdentificador() + ". Pronto finalizará.");
            } else if (todosFinalizados) {
                notificacionService.notificarAsistentesSubasta(subasta.getIdentificador(), "subasta_por_cerrar",
                        "La subasta #" + subasta.getIdentificador() + " finalizó.");
            }
        }
    }
}
